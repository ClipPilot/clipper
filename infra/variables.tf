variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "node_env" {
  description = "NODE_ENV value (staging or production)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "clipster"
}

# Backend Configuration
variable "backend_container_port" {
  description = "Port for backend container"
  type        = number
  default     = 3001
}

variable "backend_cpu" {
  description = "CPU units for backend container (1024 = 1 vCPU)"
  type        = number
  default     = 2048 # 2 vCPU - needed for video processing
}

variable "backend_memory" {
  description = "Memory for backend container in MB"
  type        = number
  default     = 4096 # 4 GB - needed for ffmpeg + puppeteer
}

variable "backend_desired_count" {
  description = "Desired number of backend tasks"
  type        = number
  default     = 2
}

# Environment Variables
variable "openai_api_key" {
  description = "OpenAI API Key"
  type        = string
  sensitive   = true
}

variable "deepgram_api_key" {
  description = "Deepgram API Key"
  type        = string
  sensitive   = true
}

variable "database_url" {
  description = "Database URL (Supabase)"
  type        = string
  sensitive   = true
}

variable "supabase_url" {
  description = "Supabase URL"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase Anon Key"
  type        = string
  sensitive   = true
}

# Frontend Configuration
variable "github_repository" {
  description = "GitHub repository for frontend (format: owner/repo)"
  type        = string
}

variable "github_access_token" {
  description = "GitHub personal access token for Amplify"
  type        = string
  sensitive   = true
}

variable "amplify_branch" {
  description = "Git branch to deploy from Amplify"
  type        = string
  default     = "main"
}

# Worker Configuration
variable "worker_cpu" {
  description = "CPU units for worker container (1024 = 1 vCPU)"
  type        = number
  default     = 4096 # 4 vCPU
}

variable "worker_memory" {
  description = "Memory for worker container in MB"
  type        = number
  default     = 8192 # 8 GB - required minimum for 4 vCPU
}

variable "worker_min_capacity" {
  description = "Minimum number of worker tasks"
  type        = number
  default     = 2
}

variable "worker_max_capacity" {
  description = "Maximum number of worker tasks"
  type        = number
  default     = 15
}

variable "worker_messages_per_task" {
  description = "Target number of SQS messages per worker task for scaling"
  type        = number
  default     = 2
}

variable "internal_api_key" {
  description = "Internal API key for worker to API communication"
  type        = string
  sensitive   = true
  default     = "a95f431eadf06dc59cbd188a72a797cc71396fdb2a92dc44721f704844cc725e"
}

# Stripe Configuration
variable "stripe_secret_key" {
  description = "Stripe Secret API Key"
  type        = string
  sensitive   = true
}

variable "stripe_webhook_secret" {
  description = "Stripe Webhook Signing Secret"
  type        = string
  sensitive   = true
}

# Domain Configuration
variable "api_domain" {
  description = "Custom domain for API (e.g., api.cuttr.com for prod, api-staging.cuttr.com for staging)"
  type        = string
  default     = ""
}

variable "frontend_url" {
  description = "Frontend URL (e.g., https://cuttr.com for prod, https://staging.cuttr.com for staging)"
  type        = string
  default     = "https://platform.cuttr.com"
}

variable "resend_api_key" {
  description = "Resend API Key for sending emails"
  type        = string
  sensitive   = true
}

variable "shared_s3_bucket" {
  description = "Use a shared S3 bucket name across environments (e.g., prod bucket name). Leave empty to create environment-specific bucket."
  type        = string
  default     = ""
}

variable "gemini_api_key" {
  description = "Gemini API Key"
  type        = string
  sensitive   = true
}

variable "admin_jwt_secret" {
  description = "JWT secret for admin dashboard authentication"
  type        = string
  sensitive   = true
}

variable "sync_key" {
  description = "Sync key for service synchronization"
  type        = string
  sensitive   = true
}

# Video Generation Keys
variable "elevenlabs_api_key" {
  description = "ElevenLabs API Key for text-to-speech"
  type        = string
  sensitive   = true
}

variable "fal_key" {
  description = "FAL API Key for AI video generation"
  type        = string
  sensitive   = true
}

# Ad Posting Webhook
variable "ad_posting_webhook_secret" {
  description = "Shared secret for botfarm ad posting webhook"
  type        = string
  sensitive   = true
  default     = ""
}

# Google Drive (Mass Posting)
variable "google_service_account_email" {
  description = "Google service account email for Drive API"
  type        = string
  default     = ""
}

variable "google_service_account_private_key" {
  description = "Google service account private key for Drive API"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_drive_parent_folder_id" {
  description = "Google Drive parent folder ID for team folders"
  type        = string
  default     = ""
}

variable "apify_api_token" {
  description = "Apify API Token for virality sync"
  type        = string
  sensitive   = true
}

variable "socialdata_api_key" {
  description = "SocialData API key for Twitter/X profile data"
  type        = string
  sensitive   = true
  default     = ""
}

variable "virality_sync_max_concurrency" {
  description = "Max parallel account syncs in Step Functions Map state"
  type        = number
  default     = 20
}

# Status Dashboard
variable "status_domain" {
  description = "Domain for the status dashboard (e.g., status.cuttr.com)"
  type        = string
  default     = "status.cuttr.com"
}

variable "status_cron_secret" {
  description = "Secret key to protect the status cron endpoint"
  type        = string
  sensitive   = true
  default     = ""
}

