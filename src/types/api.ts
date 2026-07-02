export interface SpacePublic {
  id: string;
  status: string;
  created_at: string;
  name: string;
  description: string | null;
  slug: string;
  url_id: string;
  is_default: boolean;
  is_public: boolean;
  user_id: string | null;
  user_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  predictor_id: string;
  predictor_name: string | null;
  enabled_media: string[];
  enabled_task_names: string[];
}

export interface SpacesPublic {
  data: SpacePublic[];
  count: number;
}