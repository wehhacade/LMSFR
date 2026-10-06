export type ForceRank   = "private" | "corporal" | "sergeant" | "lieutenant" | "captain" | "major";
export type ForceStatus = "on_duty" | "on_leave" | "medical" | "suspended";

export interface Force {
  id:           number;
  name:         string;
  badge_number: string;
  photo:        string;
  rank:         ForceRank;
  unit:         string;
  district:     string;
  status:       ForceStatus;
  phone:        string;
}

export interface ForceStats {
  total:     number;
  on_duty:   number;
  on_leave:  number;
  suspended: number;
}
