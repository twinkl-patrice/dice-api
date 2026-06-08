module "lambda_roll" {
    source  = "terraform-aws-modules/lambda/aws"
    version = "~> 7.0"

    function_name = "${var.service_name}-roll"
    description   = "Dice API - Roll a dice"
    handler       = "roll.handler"
    runtime       = "nodejs24.x"
    architectures = ["arm64"]
    timeout       = 10

    create_package         = false
    local_existing_package = "${var.dist_path}/api/roll.zip"
    publish                = true

    environment_variables = {
        TABLE_NAME             = aws_dynamodb_table.rolls.name
        TOPIC_ARN              = module.sns_topic.topic_arn
        DIRECT_PUBLISH_ENABLED = tostring(var.enable_direct_publish)
        POWERTOOLS_SERVICE_NAME = var.service_name
        LOG_LEVEL              = "INFO"
    }

    attach_policy_statements = true
    policy_statements = {
        dynamodb = {
            effect    = "Allow"
            actions   = ["dynamodb:PutItem"]
            resources = [aws_dynamodb_table.rolls.arn]
        }
        sns = {
            effect    = "Allow"
            actions   = ["sns:Publish"]
            resources = [module.sns_topic.topic_arn]
        }
    }

    allowed_triggers = {
        api_gateway = {
            service    = "apigateway"
            source_arn = "${module.api_gateway.api_execution_arn}/*"
        }
    }

    tags = {
        Name = "${var.service_name}-roll"
    }
}
