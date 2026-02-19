# Status Dashboard Infrastructure
# DynamoDB table for uptime history + EventBridge cron for health checks

# DynamoDB table for storing health check results
resource "aws_dynamodb_table" "status_checks" {
  name         = "${var.project_name}-status-checks-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "serviceId"
  range_key    = "date"

  attribute {
    name = "serviceId"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = {
    Name = "${var.project_name}-status-checks-${var.environment}"
  }
}

# Secrets for status dashboard
resource "aws_secretsmanager_secret" "status_cron_secret" {
  name = "${var.project_name}-status-cron-secret-${var.environment}"

  tags = {
    Name = "${var.project_name}-status-cron-secret-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "status_cron_secret" {
  secret_id     = aws_secretsmanager_secret.status_cron_secret.id
  secret_string = var.status_cron_secret
}

# EventBridge rule to trigger cron every 5 minutes
resource "aws_cloudwatch_event_rule" "status_cron" {
  name                = "${var.project_name}-status-cron-${var.environment}"
  description         = "Trigger status health checks every 5 minutes"
  schedule_expression = "rate(5 minutes)"

  tags = {
    Name = "${var.project_name}-status-cron-${var.environment}"
  }
}

# EventBridge target - calls the status cron API endpoint
resource "aws_cloudwatch_event_target" "status_cron" {
  rule = aws_cloudwatch_event_rule.status_cron.name
  arn  = aws_lambda_function.status_cron.arn
}

# Lambda function to call the status cron endpoint
resource "aws_lambda_function" "status_cron" {
  function_name = "${var.project_name}-status-cron-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  timeout       = 30

  filename         = data.archive_file.status_cron_lambda.output_path
  source_code_hash = data.archive_file.status_cron_lambda.output_base64sha256

  role = aws_iam_role.status_cron_lambda.arn

  environment {
    variables = {
      STATUS_URL    = "https://${var.status_domain}/api/cron"
      CRON_SECRET   = var.status_cron_secret
    }
  }

  tags = {
    Name = "${var.project_name}-status-cron-${var.environment}"
  }
}

# Inline lambda code packaged as a zip
data "archive_file" "status_cron_lambda" {
  type        = "zip"
  output_path = "${path.module}/.build/status-cron.zip"

  source {
    content  = <<-EOF
      exports.handler = async () => {
        const res = await fetch(process.env.STATUS_URL, {
          headers: { Authorization: `Bearer $${process.env.CRON_SECRET}` }
        });
        const body = await res.json();
        console.log(JSON.stringify(body));
        return { statusCode: res.status, body: JSON.stringify(body) };
      };
    EOF
    filename = "index.js"
  }
}

# IAM role for the cron Lambda
resource "aws_iam_role" "status_cron_lambda" {
  name = "${var.project_name}-status-cron-lambda-${var.environment}"

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
    Name = "${var.project_name}-status-cron-lambda-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "status_cron_lambda_logs" {
  role       = aws_iam_role.status_cron_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Allow EventBridge to invoke the Lambda
resource "aws_lambda_permission" "status_cron_eventbridge" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.status_cron.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.status_cron.arn
}

# IAM policy for Amplify status app to access DynamoDB
resource "aws_iam_role_policy" "amplify_status_dynamodb" {
  name = "${var.project_name}-amplify-status-dynamodb-${var.environment}"
  role = aws_iam_role.amplify.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:Query",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem"
      ]
      Resource = [
        aws_dynamodb_table.status_checks.arn
      ]
    }]
  })
}
