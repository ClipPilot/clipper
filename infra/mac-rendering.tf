# Mac Rendering Instance
# Dedicated macOS EC2 instance for Puppeteer text rendering with Apple fonts
# Currently managed manually via AWS Console (not Terraform)
# TODO: Re-import into Terraform once the instance is stable

variable "mac_renderer_url" {
  description = "URL for the Mac rendering service (set manually when instance is managed outside Terraform)"
  type        = string
  default     = ""
}

variable "mac_renderer_port" {
  description = "Port for the Mac rendering HTTP service"
  type        = number
  default     = 3100
}
