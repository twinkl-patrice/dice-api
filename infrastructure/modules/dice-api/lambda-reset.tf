module "lambda_reset" {
    source  = "terraform-aws-modules/lambda/aws"
    version = "~> 7.0"

    function_name = "${var.service_name}-reset"
    description   = "Dice API - Reset all rolls and stats"
    handler       = "reset.handler"
    runtime       = "nodejs24.x"
    architectures = ["arm64"]
    timeout       = 30

    create_package         = false
    local_existing_package = "${var.dist_path}/api/reset.zip"
    publish                = true

    environment_variables = {
        TABLE_NAME              = aws_dynamodb_table.rolls.name
        POWERTOOLS_SERVICE_NAME = var.service_name
        LOG_LEVEL               = "INFO"
    }

    attach_policy_statements = true
    policy_statements = {
        dynamodb = {
            effect = "Allow"
            actions = [
                "dynamodb:Scan",
                "dynamodb:BatchWriteItem",
                "dynamodb:DeleteItem",
            ]
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
        Name = "${var.service_name}-reset"
    }
}
