# ── SSH Key Pair ─────────────────────────────────────────────────────
# Generates an RSA key, stores private key locally + public key in AWS.

resource "tls_private_key" "bastion" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "bastion" {
  key_name   = "${var.project_name}-bastion"
  public_key = tls_private_key.bastion.public_key_openssh
}

# Save private key to disk (chmod 600 automatically via file_permission)
resource "local_sensitive_file" "bastion_key" {
  content         = tls_private_key.bastion.private_key_pem
  filename        = "${path.root}/bastion.pem"
  file_permission = "0600"
}

# ── Bastion Security Group ────────────────────────────────────────────

resource "aws_security_group" "bastion" {
  name_prefix = "${var.project_name}-bastion-"
  description = "SSH access to bastion"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${var.project_name}-bastion-sg" }

  lifecycle { create_before_destroy = true }
}

resource "aws_vpc_security_group_ingress_rule" "bastion_ssh" {
  security_group_id = aws_security_group.bastion.id
  cidr_ipv4         = var.bastion_allowed_cidr
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  description       = "SSH from allowed IP"
}

resource "aws_vpc_security_group_egress_rule" "bastion_all" {
  security_group_id = aws_security_group.bastion.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# ── Allow bastion → RDS ──────────────────────────────────────────────

resource "aws_vpc_security_group_ingress_rule" "rds_from_bastion" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.bastion.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL from bastion"
}

# ── Bastion EC2 Instance ─────────────────────────────────────────────

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-kernel-*-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

resource "aws_instance" "bastion" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = "t4g.nano"
  subnet_id                   = aws_subnet.public[0].id
  key_name                    = aws_key_pair.bastion.key_name
  vpc_security_group_ids      = [aws_security_group.bastion.id]
  associate_public_ip_address = true

  # Keep the instance tiny — only used for tunnelling
  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  tags = { Name = "${var.project_name}-bastion" }
}
