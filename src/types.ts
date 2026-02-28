export interface RatingBody {
  map_id: string;
  author: string;
  score: number; // 1..5
  comment?: string;
}

export interface RatingDbRecord extends RatingBody {
  uuid: string;
  rated_at: string;
}

export interface MapMetaBody {
  id: string;
  author: string;
  title: string;
  language?: string;
  category?: string;
  created_at: string;
  version: number;
  tag?: string;
}

export interface MapDbRecord extends MapMetaBody {
  file_key: string;
  visit_count: number;
  rating_count: number;
  rating_average: number;
  file_size: number;
  preview_key?: string;
}
