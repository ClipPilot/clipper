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
  default     = 8192 # 8 vCPU - for parallel FFmpeg processing
}

variable "worker_memory" {
  description = "Memory for worker container in MB"
  type        = number
  default     = 16384 # 16 GB - FFmpeg needs memory for parallel video processing
}

variable "worker_min_capacity" {
  description = "Minimum number of worker tasks"
  type        = number
  default     = 1
}

variable "worker_max_capacity" {
  description = "Maximum number of worker tasks"
  type        = number
  default     = 250
}

variable "worker_messages_per_task" {
  description = "Target number of SQS messages per worker task for scaling"
  type        = number
  default     = 1
}

variable "internal_api_key" {
  description = "Internal API key for worker to API communication"
  type        = string
  sensitive   = true
  default     = "a95f431eadf06dc59cbd188a72a797cc71396fdb2a92dc44721f704844cc725e"
}
