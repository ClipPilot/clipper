# Mass Post Analytics Sync
# EventBridge cron (every 12h) → HTTP API destination → POST /internal/sync-mass-post-analytics

resource "aws_cloudwatch_event_rule" "mass_post_sync" {
  name                = "${var.project_name}-mass-post-sync-${var.environment}"
  description         = "Sync analytics for mass-posted posts every 12 hours"
  schedule_expression = "cron(30 */12 * * ? *)"

  tags = {
    Name = "${var.project_name}-mass-post-sync-${var.environment}"
  }
}

# Connection holds the auth header for the API call
resource "aws_cloudwatch_event_connection" "mass_post_sync" {
  name               = "${var.project_name}-mass-post-sync-${var.environment}"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "x-internal-api-key"
      value = var.internal_api_key
    }
  }
}

# API destination defines the HTTP endpoint
resource "aws_cloudwatch_event_api_destination" "mass_post_sync" {
  name                             = "${var.project_name}-mass-post-sync-${var.environment}"
  invocation_endpoint              = var.api_domain != "" ? "https://${var.api_domain}/internal/sync-mass-post-analytics" : "http://${aws_lb.backend.dns_name}/internal/sync-mass-post-analytics"
  http_method                      = "POST"
  connection_arn                   = aws_cloudwatch_event_connection.mass_post_sync.arn
  invocation_rate_limit_per_second = 1
}

# Target connects the cron rule to the API destination
resource "aws_cloudwatch_event_target" "mass_post_sync" {
  rule     = aws_cloudwatch_event_rule.mass_post_sync.name
  arn      = aws_cloudwatch_event_api_destination.mass_post_sync.arn
  role_arn = aws_iam_role.mass_post_sync_eventbridge.arn

  http_target {
    path_parameter_values = []
    header_parameters = {
      "Content-Type" = "application/json"
    }
    query_string_parameters = {}
  }
}

# IAM role for EventBridge to invoke the API destination
resource "aws_iam_role" "mass_post_sync_eventbridge" {
  name = "${var.project_name}-mass-post-sync-eb-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "events.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "${var.project_name}-mass-post-sync-eb-${var.environment}"
  }
}

resource "aws_iam_role_policy" "mass_post_sync_eventbridge" {
  name = "invoke-api-destination"
  role = aws_iam_role.mass_post_sync_eventbridge.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "events:InvokeApiDestination"
        Resource = aws_cloudwatch_event_api_destination.mass_post_sync.arn
      }
    ]
  })
}
