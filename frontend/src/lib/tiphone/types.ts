export interface LoginCredentials {
  username: string;
  password: string;
}

export interface StoredTokens {
  access: string;
  refresh: string;
  refreshEndpoint: string;
}

export interface StoredUser {
  id: number | string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
}

export interface StoredAuth {
  tokens: StoredTokens;
  user: StoredUser;
  permissions: string[];
  roles: string[];
  hasPin: boolean;
  forcePasswordChange: boolean;
  loginAt: number;
}

export interface LoginApiResponse {
  access: string;
  refresh?: string;
  refresh_token?: string;
  refresh_endpoint?: string;
  user?: Partial<StoredUser> & Record<string, unknown>;
  username?: string;
  user_id?: number | string;
  id?: number | string;
  email?: string;
  has_pin?: boolean;
  force_password_change?: boolean;
  permissions?: string[];
  roles?: string[];
}

export interface ProfileApiResponse {
  id?: number | string;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar?: string;
  permissions?: string[];
  roles?: string[];
  has_pin?: boolean;
  force_password_change?: boolean;
}

export type AuthErrorCode =
  | "NETWORK"
  | "TIMEOUT"
  | "INVALID_CREDENTIALS"
  | "SERVER_ERROR"
  | "UNAUTHORIZED"
  | "UNKNOWN";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface SuspectListRow {
  id: number;
  name: string;
  mother?: string;
  nickname?: string;
  N_tuhunka?: string;
  Dob?: string;
  g_dhalashada?: string;
  degmada?: string;
  waaxda?: string;
  xaafadda?: string;
  marital?: string;
  children?: number;
  jailed?: string;
  occupation?: string;
  description?: string;
  tnumber?: string;
  father_contact?: string;
  mother_contact?: string;
  photo?: string;
  date_opp?: string;
  gender?: string;
  user?: number;
  seen?: boolean;
  created_ago?: string;
  created_at?: string;
  tribe?: string;
  lambarka_diiwaanka?: string;
  goobta_shaqada?: string;
  nationality?: string | null;
  is_released?: boolean;
  case_ref?: string;
  status?: string;
  risk?: string;
  captureTime?: number;
  match_score?: number;
  source?: "amniga" | "baaris" | string;
  registered_by?: string;
  registered_by_id?: number;
  wanted_id?: number;
  match_distance?: number;
}

export interface SuspectCaseRow {
  id?: number;
  case_code?: string;
  tuhunka?: string | null;
  Tuhunka?: string | null;
  d_qabashada?: string | null;
  w_qabashada?: string | null;
  description?: string | null;
  status?: string;
}

export interface DamiinRow {
  id?: number;
  damiin_id?: number;
  name?: string;
  mother?: string;
  phone?: string;
  tnumber?: string;
  photo?: string;
  picture?: string;
  relationship?: string | number;
  relationship_id?: number;
  degmada?: string;
}

export type DamiinMode = "new_damiin" | "isla_damiin" | "dhamaan_damiin" | "no_damiin";

export interface LookupRow {
  id: number | string;
  name: string;
  cid?: number | string;
}

export interface DamiinLookupRow {
  id: number;
  damiin_id?: number;
  name: string;
  phone?: string;
  degmada?: string | null;
}

export interface ExistingCaseDraft {
  suspectId: number;
  suspectName: string;
  suspectPhone?: string;
  suspectTypeId: string;
  captureCountyId: string;
  captureSubCountyId: string;
  faahfaahin: string;
  damiinMode: Exclude<DamiinMode, "no_damiin">;
  existingDamiinId: string;
  islaDamiinId: string;
  damiinName: string;
  damiinPhone: string;
  damiinGender: string | null;
  relationshipId: string;
  damiinCountyId: string;
}

export interface SuspectRegisterDraft {
  fullname: string;
  mother: string;
  phone: string;
  gender: string | null;
  identityCard: string;
  occupation: string;
  addressCountyId: string | null;
  addressCountyName: string | null;
  suspectTypeId: string | null;
  suspectTypeName: string | null;
  captureCountyId: string | null;
  captureCountyName: string | null;
  captureSubCountyId: string | null;
  captureSubCountyName: string | null;
  faahfaahin: string;
  damiinMode: DamiinMode;
  islaDamiinId: string | null;
  islaDamiinName: string | null;
  existingDamiinId: string | null;
  existingDamiinName: string | null;
  damiinName: string;
  damiinGender: string | null;
  damiinPhone: string;
  damiinCountyId: string | null;
  damiinCountyName: string | null;
  relationshipId: string | null;
  relationshipName: string | null;
  /** object URL preview — File is kept separately in the hook */
  pictureUri: string | null;
  damiinIdentityUri: string | null;
  damiinPictureUri: string | null;
  currentStep: number;
  timestamp: number;
}

export type RegisterFieldErrors = Partial<Record<keyof SuspectRegisterDraft | "submit", string>>;

export interface CountyRow {
  id: number;
  name: string;
}

export interface SuspectResponseRow {
  id: number;
  response_id?: number;
  howManyComment?: number;
  name?: string;
  suspect_id?: number;
  photo?: string;
  degmo?: string;
  details?: string;
  userka?: string;
  tariikhda?: string;
  /** legacy / loose aliases */
  response?: string;
  comment?: string;
  created_at?: string;
  created_ago?: string;
  user_name?: string;
}

export interface ResponseCommentRow {
  id: number;
  howmanyreplay?: number;
  howManyComment?: number;
  name?: string;
  comment?: string;
  images?: string;
  audio?: string;
  userka?: string;
}

export interface CommentReplyRow {
  id: number;
  comment_id: number;
  details?: string;
  userka?: string;
  tariikhda?: string;
}

export interface ResponseAuthor {
  name: string;
  seed: number;
  badge?: string | null;
}

export interface ResponseAttachment {
  type: "audio" | "image" | "file";
  duration?: number;
  name?: string;
  size?: string;
  dataUrl?: string;
}

export interface ResponseComment {
  id: string;
  author: ResponseAuthor;
  when: string;
  text?: string;
  attachments?: ResponseAttachment[];
  reactions?: { heart: number };
  liked?: boolean;
  replies: ResponseComment[];
  replyCount?: number;
  repliesLoaded?: boolean;
}

export interface ResponsePost {
  id: string;
  suspect: {
    id: string;
    name: string;
    district: string;
    photo?: string;
    seed: number;
    alias?: string;
  };
  author: ResponseAuthor;
  when: string;
  description: string;
  reactions: { heart: number };
  comments: ResponseComment[];
  liked?: boolean;
  commentCount?: number;
  commentsLoaded?: boolean;
}

export interface NoticeRow {
  id?: number;
  tobic_id?: number;
  title?: string;
  message?: string;
  body?: string;
  created_at?: string;
  status?: number | string;
  [key: string]: unknown;
}

export interface DamiinListRow {
  id: number;
  name?: string;
  mother?: string;
  phone?: string;
  tnumber?: string;
  picture?: string;
  photo?: string;
  degmada?: string;
  date?: string;
  goobta_shaqada?: string;
  suspect_count?: number;
  suspects?: Array<{ suspect_id: number; name: string; degmada?: string }>;
  created_ago?: string;
  [key: string]: unknown;
}

export interface DamiinDetailRow {
  Damiinada_id: number;
  picture?: string;
  name: string;
  phone?: string;
  relationship?: string;
  degmada?: string;
  occupation?: string;
  goobta_shaqada?: string;
  suspects: Array<{
    suspect_id: number;
    name: string;
    Tuhunka?: string;
    d_qabashada?: string;
    w_qabashada?: string;
    description?: string;
  }>;
}

export type TipPhoneScreen =
  | "login"
  | "home"
  | "suspects"
  | "responses"
  | "profile"
  | "register"
  | "existing-case"
  | "damiinada"
  | "damiin-detail"
  | "wanted"
  | "notices"
  | "baaris"
  | "aqoonsi-register"
  | "maareynta"
  | "user-management"
  | "leaders";

export type BottomNavTab = "home" | "suspects" | "responses";

export interface ManagedUserRow {
  id: number;
  username: string;
  phone: string;
  email: string;
  county: string;
  lastlogin: string;
  is_active: boolean;
  distanceKm?: number | null;
  isClosest?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AppInstallationDepartment {
  id: number;
  name: string;
  counties: CountyRow[];
}

export interface AppInstallationUserRow {
  id: number;
  username: string;
  /** Login name used at sign-in; `username` may be the display name. */
  loginUsername: string;
  phone: string;
  email: string;
  county: string;
  employeeNumber: string;
  isActive: boolean;
  lastlogin: string;
  groups: { id: number; name: string }[];
  appInstalled: boolean;
  installationStatus: AppInstallationStatus;
  installationLabel: "Loogu shubay" | "iPhone" | "Looguma shubin";
  notInstalledReason: NotInstalledReason | "";
  notInstalledReasonLabel: string;
  notInstalledReasonDetail: string;
  installedAt?: string | null;
}

export type AppInstallationStatus = "not_installed" | "completed" | "iphone";
export type NotInstalledReason =
  | "did_not_attend"
  | "basic_phone"
  | "no_phone"
  | "unsupported_phone"
  | "no_internet"
  | "login_issue"
  | "refused"
  | "other";

export interface AppPermissionGroup {
  id: number;
  name: string;
  permissionCount?: number;
}

export interface AppInstallationSummary {
  total: number;
  completed: number;
  iphone: number;
  /** Compatibility alias: identical to completed. */
  installed: number;
  notInstalled: number;
}

export interface SuspectVehicle {
  id: number;
  make: string;
  plate: string;
  detail?: string;
  photoUrl?: string;
  ownership?: string;
  ownerName?: string;
  ownerPhone?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
}
