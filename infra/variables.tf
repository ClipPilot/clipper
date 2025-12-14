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
  default     = 2048  # 2 vCPU - needed for video processing
}

variable "backend_memory" {
  description = "Memory for backend container in MB"
  type        = number
  default     = 4096  # 4 GB - needed for ffmpeg + puppeteer
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
