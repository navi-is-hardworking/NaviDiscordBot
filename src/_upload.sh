#### For running 24/7 on aws instance. Make sure logging level is set to warning.

#!/bin/bash
source /c/Users/cbrow/crbw/Git/bash_environment/bashrc

# Build Docker image
docker build -t bot .

# Save image to tar file
docker save bot | gzip > bot.tar.gz

# Upload to EC2
scp -i ~/.ssh/my-ec2-key.pem bot.tar.gz ec2-user@$AWS_ADDRESS:/home/ec2-user/

# SSH to EC2, load image and run container
ssh -i ~/.ssh/my-ec2-key.pem ec2-user@$AWS_ADDRESS "docker load < bot.tar.gz && docker stop bot || true && docker rm bot || true && docker image prune -f && docker run -d --name bot --restart unless-stopped bot"

rm -f bot.tar.gz
ssh -i ~/.ssh/my-ec2-key.pem ec2-user@$AWS_ADDRESS "docker image prune -a -f && rm -f bot.tar.gz"