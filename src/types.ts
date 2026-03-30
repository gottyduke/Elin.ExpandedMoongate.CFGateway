export interface RatingBody {
  map_id: string;
  user_id: string;
  rated_at?: string;
}

export interface RatingDbRecord extends RatingBody {
  visited_at: string;
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
  preview_key?: string;
  file_size: number;
  view_id?: string;
}

export interface MapDbRecordWithRating extends MapDbRecord {
  user_rating?: RatingDbRecord;
}

export interface MapsOverviewBody {
  maps_count: number;
  visits_count: number;
  ratings_count: number;
  maps_today: number;
  visits_today: number;
  ratings_today: number;
}

export type RouteContext = {
  request: Request;
  env: Env;
  requestId: string;
  bypass: boolean;
  ctx: ExecutionContext;
};

export type RouteHandler = (ctx: RouteContext) => Promise<Response | null>;
