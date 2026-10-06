# Create your models here.
from datetime import date
import os

from django.db import models

from apps.accounts.models import (
    County,
    Directorate,
    Region,
    Section,
    SubCounty,
    User,
)

currentDate = date.today()
Cyear = currentDate.strftime("%Y")
CMonth = currentDate.strftime("%m")

'''Form-ka Shaxda Dhacdooyinka'''


class NoocaDhacdooyinkaGuud(models.Model):
    name = models.CharField(max_length=50, blank=True, null=True)  
    created_at = models.DateTimeField(auto_now_add=True)
    update_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'NoocaDhacdooyinkaGuud'.lower()

    def __str__(self):
        return self.name
  
    
class NoocaDhaxdooyinka(models.Model):
    type = models.CharField(max_length=50, blank=True, null=True)   
    nooca_dhacdooyinka_guud = models.ForeignKey(to=NoocaDhacdooyinkaGuud, on_delete=models.CASCADE, blank=True, null=True)
    date_recorded = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    update_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'noocyada_dhacdooyinka'.lower()

    def __str__(self):
        return self.type

class Dhacdooyinka(models.Model):
    """Final official incidents from Laanta Warqabadka - Layer 3 (HIGHEST AUTHORITY)"""
    
    category = models.CharField(max_length=50, blank=True, null=True)
    tixraac_lambar = models.CharField(max_length=50, blank=True, null=True)
    tafaasiisha_goobta_dhacdada = models.TextField(blank=True, null=True)
    taariikhda_dhacdada = models.CharField(
        max_length=50, blank=True, null=True)
    waaxda = models.ForeignKey(SubCounty, on_delete=models.CASCADE, blank=True, null=True)
    gobolka = models.ForeignKey(Region, on_delete=models.CASCADE, blank=True, null=True)
    degmada = models.ForeignKey(County, on_delete=models.CASCADE, blank=True, null=True)
    laanta = models.ForeignKey(Section, on_delete=models.CASCADE, blank=True, null=True)
    
    bartilmaameedka_dhacdada = models.CharField(max_length=100, blank=True, null=True)
    cidda_fulisay = models.CharField(max_length=100, blank=True, null=True)
    nooca_dhacdada = models.ForeignKey(to=NoocaDhaxdooyinka, on_delete=models.CASCADE,blank=True, null=True)   
    khasaaraha_dhacdada = models.CharField(        max_length=100, blank=True, null=True)
    tirada = models.CharField(max_length=50, blank=True, null=True)
    dhimasho = models.CharField(max_length=100, blank=True, null=True)
    dhaawac = models.CharField(max_length=100, blank=True, null=True)
    xuuraanshe = models.CharField(max_length=100, blank=True, null=True)
    xuuraan_bille = models.CharField(max_length=100, blank=True, null=True)
    latitude = models.CharField(
        max_length=50, blank=True, null=True, default=0)
    longitude = models.CharField(
        max_length=50, blank=True, null=True, default=0)
    dhacdada_status = models.CharField(
        max_length=100, blank=True, null=True)
    upload_document = models.FileField(
        upload_to='dhacdooyinka/uploads/docs/', blank=True, null=True)
    dhacdo_type = models.CharField(max_length=100, blank=True, null=True)
    date_recorded = models.DateTimeField(auto_now_add=True)
    
    recorded_by = models.ForeignKey(User, on_delete=models.CASCADE, blank=True, null=True)
    
    year = models.CharField(max_length=20, blank=True, null=True)
    month = models.CharField(max_length=20, blank=True, null=True)
    date_opp = models.DateField(null=True, blank=True)
    
    director = models.ForeignKey(
        Directorate, verbose_name="Directorate", on_delete=models.RESTRICT, null=True, blank=True)

 
    is_official = models.BooleanField(default=True, help_text="This is an official incident record from Laanta Warqabadka")

    class Meta:
        db_table = 'dhacdooyinka'
        permissions = [
            # Highest Authority Custom Permissions (Layer 3)
            ('approve_incidents', 'Can approve incidents from Laanta Warqabadka'),
            ('reject_incidents', 'Can reject incidents from Laanta Warqabadka'),
            ('create_final_report', 'Can create final official report'),
            ('view_workflow_trail', 'Can view complete workflow trail'),
            ('manage_all_layers', 'Can manage all three layers'),
            ('view_dhacdo_sirdoon', 'wuxu arki kara dhacdooyinka Sirdoon'),       
            ('view_dhacdo_amni', 'wuxu arki kara dhacdooyinka Amni'),
         ]

    def __str__(self):
        return self.tixraac_lambar 

    def upload_documentUrl(self):
        if self.upload_document and hasattr(self.upload_document, 'url'):
            return self.upload_document.url

    def filename(self):
        return os.path.basename(str(self.upload_document.name))

    def extension(self):
        name, extension = os.path.splitext(str(self.upload_document.name))
        return extension

    def primary_fahfaahin(self) -> str:
        """First dump/v3 narrative: tafaasiisha, else earliest faahfaahinta.fahfaahin."""
        stored = (self.tafaasiisha_goobta_dhacdada or "").strip()
        if stored:
            return stored
        cache = getattr(self, "_prefetched_objects_cache", None)
        rows = cache.get("faahfaahinta_set") if isinstance(cache, dict) and "faahfaahinta_set" in cache else None
        if rows is None:
            rows = self.faahfaahinta_set.exclude(fahfaahin__isnull=True).exclude(fahfaahin="").order_by(
                "date_recorded", "id"
            )
        for row in rows:
            text = (row.fahfaahin or "").strip()
            if text:
                return text
        return ""


class Faahfaahinta(models.Model):
    """Follow-up narrative updates on a final incident (Laanta Warqabadka log)."""

    dhacdo = models.ForeignKey(
        to=Dhacdooyinka, on_delete=models.CASCADE, blank=True, null=True, related_name="faahfaahinta_set"
    )
    fahfaahin = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50, blank=True, null=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True)
    year = models.CharField(max_length=20, blank=True, null=True)
    month = models.CharField(max_length=20, blank=True, null=True)
    date_recorded = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "faahfaahinta"
        ordering = ["-date_recorded"]

    def __str__(self):
        return (self.fahfaahin or "")[:60]


class DhacdoDocuments(models.Model):
    """Official documents for final incidents (Layer 3)"""
    name = models.FileField(blank=True, null=True, upload_to='dhacdo_documents/')
    dhacdo = models.ForeignKey(Dhacdooyinka, on_delete=models.SET_NULL, blank=True, null=True)
    
    def uploadedfile_url(self):
        if self.name and hasattr(self.name, 'url'):
            return self.name.url
    
    def document_details(self):
        return {
            'name': self.name.name,
            'url': self.uploadedfile_url(),
            'extension': self.extension()
        }
    
    def extension(self):
        name, extension = os.path.splitext(str(self.name.name))
        return extension


class Dhibanayaashas(models.Model):
    magaca = models.CharField(max_length=100, blank=True, null=True)
    dada_dh = models.CharField(max_length=100, blank=True, null=True)
    gender = models.CharField(max_length=100, blank=True, null=True)
    xalada = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=100, blank=True, null=True)
    fahfaahin = models.TextField(blank=True, null=True)
    dhacdo = models.ForeignKey(to=Dhacdooyinka, on_delete=models.CASCADE, blank=True, null=True)
    recorded_by = models.ForeignKey(User, on_delete=models.CASCADE, blank=True, null=True)
    year = models.CharField(max_length=20, blank=True, null=True)
    month = models.CharField(max_length=20, blank=True, null=True)
    
    date_recorded = models.DateField(auto_now_add=True)
    updated_at = models.DateField(auto_now=True)

    class Meta:
        db_table = 'Dhibanayaashas'.lower()

    def __str__(self):
        return self.magaca
    
class Dhibane_documents(models.Model):   
    dhibane = models.ForeignKey(Dhibanayaashas, on_delete=models.RESTRICT, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.RESTRICT, null=True, blank=True)    
    document = models.FileField(upload_to="fejignaanta/", null=True, blank=True)
    date_recorded = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    def upload_documentUrl(self):
        if self.document and hasattr(self.document, 'url'):
            return self.document.url

    def filename(self):
        return os.path.basename(str(self.document.name))
    # file extension

    def extension(self):
        name, extension = os.path.splitext(str(self.document.name))
        return extension
    def get_document_detail(self):
        return get_image_description1(self, self.document)

    class Meta:
        db_table = 'Dhibane_documents'.lower()


def get_image_description1(image_self, image_url):
    try:
        if image_url is not None or image_url != '' or image_url != "null":
            file = image_url
            split_file = file.name.split('/')[-1].split('.')

            # Default icon and color
            icon = 'ri-file-list-line'
            color = 'primary'

            # PDF file type
            if split_file[1].lower() == 'pdf':
                icon = 'ri-file-pdf-line'
                color = 'danger'

            # PowerPoint file type
            if split_file[1].lower() == 'ppt' or split_file[1].lower() == 'pptx':
                icon = 'ri-file-ppt-2-line'
                color = 'danger'

            # Word file type
            if split_file[1].lower() == 'doc' or split_file[1].lower() == 'docx':
                icon = 'ri-file-word-2-line'
                color = 'secondary'

            # Image file types (jpg, png, jpeg)
            if split_file[1].lower() == 'png' or split_file[1].lower() == 'jpg' or split_file[1].lower() == 'jpeg':
                icon = 'ri-image-2-fill'
                color = 'success'

            # Text file type
            if split_file[1].lower() == 'txt':
                icon = 'ri-file-text-line'
                color = 'dark'

            # Excel file type
            if split_file[1].lower() == 'xlsx':
                icon = 'ri-file-excel-2-line'
                color = 'success'

            # Video file types (mp4, avi, mkv)
            if split_file[1].lower() == 'mp4' or split_file[1].lower() == 'avi' or split_file[1].lower() == 'mkv':
                icon = 'ri-video-line'
                color = 'info'

            # Audio file types (mp3, wav, flac)
            if split_file[1].lower() == 'mp3' or split_file[1].lower() == 'wav' or split_file[1].lower() == 'flac':
                icon = 'ri-headphones-line'
                color = 'warning'

            # Return a dictionary with file details
            return {
                'size': pretty_size(file.size),
                'extension': split_file[1].upper(),
                'name': split_file[0],
                'icon': icon,
                'color': color,
                'url': image_self.uploadedfile_url()
            }
    except (FileNotFoundError, IndexError, AttributeError):
        # Return empty data if an error occurs
        return {
            'size': "",
            'extension': "",
            'name': "",
            'icon': "",
            'color': "",
            'url': ""
        }


UNITS_MAPPING = [
    (1 << 50, ' PB'),
    (1 << 40, ' TB'),
    (1 << 30, ' GB'),
    (1 << 20, ' MB'),
    (1 << 10, ' KB'),
    (1, (' byte', ' bytes')),
]


def pretty_size(bytes, units=UNITS_MAPPING):
    for factor, suffix in units:
        if bytes >= factor:
            break
    amount = int(bytes / factor)

    if isinstance(suffix, tuple):
        singular, multiple = suffix
        if amount == 1:
            suffix = singular
        else:
            suffix = multiple
    return str(amount) + suffix

