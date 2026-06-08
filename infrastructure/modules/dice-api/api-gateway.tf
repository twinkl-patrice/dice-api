module "api_gateway" {
    source  = "terraform-aws-modules/apigateway-v2/aws"
    version = "~> 5.0"

    name          = "${var.service_name}-api"
    description   = "Dice API - AWS Overview Workshop"
    protocol_type = "HTTP"

    create_domain_name = false

    cors_configuration = {
        allow_origins = ["*"]
        allow_methods = ["GET", "POST", "DELETE", "OPTIONS"]
        allow_headers = ["Content-Type", "x-api-key"]
        max_age       = 300
    }

    authorizers = {
        api_key = {
            authorizer_type                   = "REQUEST"
            authorizer_uri                    = module.lambda_authoriser.lambda_function_invoke_arn
            authorizer_payload_format_version = "2.0"
            identity_sources                  = ["$request.header.x-api-key"]
            name                              = "${var.service_name}-api-key-authoriser"
            enable_simple_responses           = true
        }
    }

    routes = {
        "POST /roll" = {
            integration = {
                uri                    = module.lambda_roll.lambda_function_arn
                payload_format_version = "2.0"
            }
        }

        "GET /stats" = {
            integration = {
                uri                    = module.lambda_stats.lambda_function_arn
                payload_format_version = "2.0"
            }
        }

        "DELETE /reset" = {
            authorization_type = "CUSTOM"
            authorizer_key     = "api_key"
            integration = {
                uri                    = module.lambda_reset.lambda_function_arn
                payload_format_version = "2.0"
            }
        }
    }

    tags = {
        Name = "${var.service_name}-api"
    }
}
