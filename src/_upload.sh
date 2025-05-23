#### For running 24/7 on aws instance. Make sure logging level is set to warning.

#!/bin/bash

# Comment out this line... this is mine 
source /c/Users/cbrow/crbw/Git/bash_environment/bashrc

# Hey. You made it here. Noice
# Replace these two with your key and ip addres for you aws
KEY_FILE_LOCATION=~/.ssh/my-ec2-key.pem
AWS_ADDRESS="42.069.123"


# Build Docker image
docker build -t bot .


# Save image to tar file
docker save bot | gzip > bot.tar.gz

# Mgiht need to add restarter
# Upload to EC2
scp -i $KEY_FILE_LOCATION bot.tar.gz ec2-user@$AWS_ADDRESS:/home/ec2-user/

# SSH to EC2, load image and run container
ssh -i $KEY_FILE_LOCATION ec2-user@$AWS_ADDRESS "docker load < bot.tar.gz && docker stop bot || true && docker rm bot || true && docker image prune -f && docker run -d --name bot --restart unless-stopped bot"

rm -f bot.tar.gz
ssh -i $KEY_FILE_LOCATION ec2-user@$AWS_ADDRESS "docker image prune -a -f && rm -f bot.tar.gz"