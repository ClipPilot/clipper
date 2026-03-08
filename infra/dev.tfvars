# Development Environment Configuration
# Usage: terraform apply -var-file=dev.tfvars

environment = "dev"
node_env    = "development"

# Worker - minimal for dev
worker_min_capacity = 1
worker_max_capacity = 2

# Backend
backend_desired_count = 1

# Frontend
frontend_url = "http://localhost:3000"

# Mac rendering - disabled in dev (runs locally)
mac_renderer_url = ""
