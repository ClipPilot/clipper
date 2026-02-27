# Mass Post Analytics Sync
# EventBridge cron (every 12h) → inline Lambda → POST /internal/sync-mass-post-analytics

resource "aws_cloudwatch_event_rule" "mass_post_sync" {
  name                = "${var.project_name}-mass-post-sync-${var.environment}"
  description         = "Sync analytics for mass-posted posts every 12 hours"
  schedule_expression = "cron(30 */12 * * ? *)"

  tags = {
    Name = "${var.project_name}-mass-post-sync-${var.environment}"
  }
}

resource "aws_cloudwatch_event_target" "mass_post_sync" {
  rule = aws_cloudwatch_event_rule.mass_post_sync.name
  arn  = aws_lambda_function.mass_post_sync.arn
}

resource "aws_lambda_function" "mass_post_sync" {
  function_name = "${var.project_name}-mass-post-sync-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  timeout       = 300

  filename         = data.archive_file.mass_post_sync_lambda.output_path
  source_code_hash = data.archive_file.mass_post_sync_lambda.output_base64sha256

  role = aws_iam_role.mass_post_sync_lambda.arn

  environment {
    variables = {
      API_URL          = var.api_domain != "" ? "https://${var.api_domain}/internal/sync-mass-post-analytics" : "http://${aws_lb.backend.dns_name}/internal/sync-mass-post-analytics"
      INTERNAL_API_KEY = var.internal_api_key
    }
  }

  tags = {
    Name = "${var.project_name}-mass-post-sync-${var.environment}"
  }
}

data "archive_file" "mass_post_sync_lambda" {
  type        = "zip"
  output_path = "${path.module}/.build/mass-post-sync.zip"

  source {
    content  = <<-EOF
      exports.handler = async () => {
        const res = await fetch(process.env.API_URL, {
          method: "POST",
          headers: { "x-internal-api-key": process.env.INTERNAL_API_KEY, "Content-Type": "application/json" }
        });
        const body = await res.json();
        console.log(JSON.stringify(body));
        return { statusCode: res.status, body: JSON.stringify(body) };
      };
    EOF
    filename = "index.js"
  }
}

resource "aws_iam_role" "mass_post_sync_lambda" {
  name = "${var.project_name}-mass-post-sync-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "${var.project_name}-mass-post-sync-lambda-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "mass_post_sync_lambda_logs" {
  role       = aws_iam_role.mass_post_sync_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_permission" "mass_post_sync_eventbridge" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mass_post_sync.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.mass_post_sync.arn
}
