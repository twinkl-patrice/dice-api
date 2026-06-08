module "lambda_stats" {
    source  = "terraform-aws-modules/lambda/aws"
    version = "~> 7.0"

    function_name = "${var.service_name}-stats"
    description   = "Dice API - Get rolling statistics"
    handler       = "stats.handler"
    runtime       = "nodejs24.x"
    architectures = ["arm64"]
    timeout       = 10

    create_package         = false
    local_existing_package = "${var.dist_path}/api/stats.zip"
    publish                = true

    environment_variables = {
        TABLE_NAME              = aws_dynamodb_table.rolls.name
        POWERTOOLS_SERVICE_NAME = var.service_name
        LOG_LEVEL               = "INFO"
    }

    attach_policy_statements = true
    policy_statements = {
        dynamodb = {
            effect    = "Allow"
            actions   = ["dynamodb:GetItem"]
            resources = [aws_dynamodb_table.rolls.arn]
        }
    }

    allowed_triggers = {
        api_gateway = {
            service    = "apigateway"
            source_arn = "${module.api_gateway.api_execution_arn}/*"
        }
    }

    tags = {
        Name = "${var.service_name}-stats"
    }
}
