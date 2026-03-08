# Mac Renderer Configuration
#
# The Mac renderer is exposed via Tailscale Funnel, so ECS workers
# reach it over regular HTTPS through their NAT gateway.
# No relay instance or VPC routing needed.

variable "mac_renderer_url" {
  description = "Public URL for the Mac rendering service (Tailscale Funnel URL)"
  type        = string
  default     = "https://macs-mac-mini.tail179295.ts.net"
}
