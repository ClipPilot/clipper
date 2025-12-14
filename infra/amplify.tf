# AWS Amplify App for Frontend
# TEMPORARILY DISABLED - Enable after configuring GitHub Personal Access Token
# See AMPLIFY_SETUP.md for instructions

# To enable Amplify:
# 1. Create a GitHub Personal Access Token with 'repo' and 'admin:repo_hook' scopes
# 2. Add it to GitHub Secrets as GH_PAT
# 3. Uncomment all resources below
# 4. Run terraform apply

# resource "aws_amplify_app" "frontend" {
#   name       = "${var.project_name}-frontend-${var.environment}"
#   repository = "https://github.com/${var.github_repository}"
#
#   access_token = var.github_access_token
#
#   # Build settings
#   build_spec = <<-EOT
#     version: 1
#     applications:
#       - frontend:
#           phases:
#             preBuild:
#               commands:
#                 - cd frontend
#                 - npm install -g pnpm
#                 - pnpm install
#             build:
#               commands:
#                 - pnpm run build
#           artifacts:
#             baseDirectory: frontend/.next
#             files:
#               - '**/*'
#           cache:
#             paths:
#               - frontend/node_modules/**/*
#               - frontend/.next/cache/**/*
#         appRoot: frontend
#   EOT
#
#   # Environment variables for frontend
#   environment_variables = {
#     NEXT_PUBLIC_API_URL = "http://${aws_lb.backend.dns_name}/api"  # Using HTTP for now - update to HTTPS when custom domain is configured
#     NODE_ENV            = "production"
#     _LIVE_UPDATES       = jsonencode([{
#       pkg     = "next"
#       type    = "internal"
#       version = "latest"
#     }])
#   }
#
#   # Custom rules
#   custom_rule {
#     source = "/<*>"
#     status = "404"
#     target = "/index.html"
#   }
#
#   # Enable auto branch creation for pull requests
#   enable_auto_branch_creation = false
#   enable_branch_auto_build    = true
#   enable_branch_auto_deletion = false
#
#   # Platform settings
#   platform = "WEB_COMPUTE"
#
#   # IAM service role
#   iam_service_role_arn = aws_iam_role.amplify.arn
#
#   tags = {
#     Name = "${var.project_name}-frontend-${var.environment}"
#   }
# }
#
# # Amplify Branch
# resource "aws_amplify_branch" "main" {
#   app_id      = aws_amplify_app.frontend.id
#   branch_name = var.amplify_branch
#
#   enable_auto_build = true
#
#   framework = "Next.js - SSR"
#   stage     = var.environment == "prod" ? "PRODUCTION" : "DEVELOPMENT"
#
#   tags = {
#     Name = "${var.project_name}-${var.amplify_branch}-${var.environment}"
#   }
# }
#
# # Amplify Domain Association (optional - add your custom domain)
# # resource "aws_amplify_domain_association" "frontend" {
# #   app_id      = aws_amplify_app.frontend.id
# #   domain_name = "yourdomain.com"
# #
# #   sub_domain {
# #     branch_name = aws_amplify_branch.main.branch_name
# #     prefix      = var.environment == "prod" ? "" : var.environment
# #   }
# # }
