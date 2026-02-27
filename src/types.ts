export interface RatingBody {
  MapId: string;
  UserId: string;
  Score: number; // 1..5
  Comment?: string;
}

export interface MapUploadBody {
  Author: string;
  Title?: string;
  Lang?: string;
  Cat?: string;
  Date?: string;
  Version: number;
  Tag?: string;
  IsOfficial?: boolean;
}