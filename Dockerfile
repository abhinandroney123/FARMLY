# ==============================================================================
# FARMLY Poultry Farm Management — Red Hat OpenShift Certified Container Image
# Base: Red Hat Universal Base Image (UBI 9) Node.js 20
# ==============================================================================
FROM registry.access.redhat.com/ubi9/nodejs-20:latest

LABEL name="farmly-poultry-management" \
      version="1.0.0" \
      summary="FARMLY Single Farm Poultry Management System" \
      description="Farmly backend REST API & responsive web application for OpenShift"

USER 0

WORKDIR /opt/app-root/src

# Copy package definitions and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY . .

# Ensure data directory exists and configure OpenShift arbitrary non-root UID permissions (group 0)
RUN mkdir -p /opt/app-root/src/data/backups && \
    chown -R 1001:0 /opt/app-root/src && \
    chmod -R g+rwX /opt/app-root/src

# Switch to standard OpenShift non-root user
USER 1001

EXPOSE 8080

ENV PORT=8080 \
    NODE_ENV=production

CMD ["node", "server.js"]
