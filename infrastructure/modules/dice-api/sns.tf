module "sns_topic" {
    source  = "terraform-aws-modules/sns/aws"
    version = "~> 6.0"

    name = "${var.service_name}-roll-events"

    tags = {
        Name = "${var.service_name}-roll-events"
    }
}
