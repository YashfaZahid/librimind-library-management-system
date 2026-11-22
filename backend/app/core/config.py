from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    app_env: str = "development"
    static_dir: str = ""
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""

    @property
    def auth_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def model_configured(self) -> bool:
        return bool(self.llm_api_key.strip())

    @property
    def model_name(self) -> str:
        return self.llm_model.strip() or "gpt-4o-mini"

    @property
    def model_base(self) -> str:
        return (self.llm_base_url.strip() or "https://api.openai.com/v1").rstrip("/")

    @property
    def origin_list(self) -> list[str]:
        return [part.strip() for part in self.cors_origins.split(",") if part.strip()]
