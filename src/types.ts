export interface RatingBody {
  map_id: string;
  user_id: string;
  visited_at: string;
}

export interface RatingDbRecord extends RatingBody {
  rated_at?: string;
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
  file_size: number;
  preview_key?: string;
}
