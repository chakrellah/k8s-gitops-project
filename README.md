# K8s GitOps Project with ArgoCD
##  Kubernetes Setup Guide: Argo CD, Vault, and Application Services

This guide provides detailed and professional instructions to install and configure Argo CD for GitOps-based deployment, integrate HashiCorp Vault for secure secret management, and expose key monitoring and application services (Grafana, Prometheus, NodeJS API) in a Kubernetes environment.

---

## 1. Install and Configure Argo CD

Argo CD is a declarative, GitOps continuous delivery tool for Kubernetes. It tracks application manifests in Git repositories and applies them automatically to the cluster.

### 1.1 Create Namespace and Install Argo CD
Create the `argocd` namespace and install Argo CD using the official manifest.
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### 1.2 Verify Installation
Ensure all Argo CD pods are running properly:
```bash
kubectl get pods -n argocd
```

### 1.3 Expose the Argo CD UI
Port-forward the Argo CD API server to access it locally via your browser:
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### 1.4 Log In to Argo CD
Authenticate using the CLI:
```bash
argocd login localhost:8080
```

### 1.5 Retrieve Initial Admin Password
By default, the initial password is stored in a Kubernetes secret:
```bash
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d && echo
```

### 1.6 List Services in the "app" Namespace
Use this command to view all services (including Grafana, Prometheus, Vault, etc.) running under the `app` namespace:
```bash
kubectl get svc -n app
```

### 1.7 Deploy Changes to Helm-based Applications
To apply updates made to Helm charts or manifests:
```bash
kubectl apply -f argo/apps/grafana-prometheus.yaml
```

---

## 2. Port-Forward Application Services

To access internal services (NodeJS API, Grafana, Prometheus, Vault) from your local machine, port-forward their respective Kubernetes services.

### NodeJS API:
```bash
kubectl port-forward svc/nodejs-api -n app 3000:3000
```

### Grafana:
```bash
kubectl port-forward svc/grafana -n app 32000:80
```

### Prometheus:
```bash
kubectl port-forward svc/prometheus-server -n app 32001:80
```

### Vault:
```bash
kubectl port-forward svc/vault -n app 8200:8200
```

---

## 3. Initialize and Unseal Vault

Vault must be initialized and unsealed before use. This step generates cryptographic keys and a root token for accessing the API.

### 3.1 Initialize Vault
```bash
kubectl exec -ti vault-0 -n app -- vault operator init
```
This generates:
- 5 Unseal Keys
- 1 Initial Root Token

> ⚠️ Save these securely. You need **any 3 unseal keys** to unseal the Vault, and the **root token** to log in and configure secrets.

### 3.2 Unseal Vault (Run 3 Times with Different Keys)
```bash
kubectl exec -ti vault-0 -n app -- vault operator unseal
```
Repeat this command three times using different unseal keys.

### 3.3 Access the Vault Pod
```bash
kubectl exec -it vault-0 -n app -- sh
```

### 3.4 Authenticate with Vault
```bash
vault login <your-root-token>
```
Use the root token obtained during initialization.

---

## 4. Enable Kubernetes Authentication in Vault

Kubernetes authentication enables applications running inside the cluster to authenticate with Vault using their service account tokens.

### 4.1 Enable Kubernetes Auth Method
```bash
vault auth enable kubernetes
```

### 4.2 Create a Policy for NodeJS API
This policy defines what secrets the application can access:
```bash
vault policy write nodejs-api-policy - <<EOF
path "kv/data/nodejs-api" {
  capabilities = ["read"]
}
EOF
```

### 4.3 Configure Kubernetes Authentication
This step connects Vault to the Kubernetes API:
```bash
vault write auth/kubernetes/config \
  token_reviewer_jwt="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  kubernetes_host="https://127.0.0.1:6443" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
```

### 4.4 Create a Role for the Application
Map the Kubernetes service account to the Vault policy:
```bash
vault write auth/kubernetes/role/nodejs-api-role \
  bound_service_account_names=nodejs-api \
  bound_service_account_namespaces=app \
  policies=nodejs-api-policy \
  ttl=1h
```

### 4.5 Verify the Policy
```bash
vault policy read nodejs-api-policy
```
Ensure the policy is configured correctly.

---

## 5. Store Secrets in Vault

Vault can securely store your database credentials or API keys.

### 5.1 Retrieve PostgreSQL Credentials
Get the password from your Postgres pod environment:
```bash
kubectl exec -it postgres-postgresql-0 -n app -- bash
env | grep POSTGRES
```

### 5.2 Store the Database URL in Vault
Replace `<POSTGRES_PASSWORD>` with the actual password:
```bash
vault kv put kv/nodejs-api DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@postgres-postgresql:5432/postgres"
```

---

## 6. Restart Application

To apply the updated secret configuration from Vault:
```bash
kubectl rollout restart deployment nodejs-api -n app
```
This ensures the application picks up the new environment variables from Vault.

---

### ✅ Setup Complete

You have now successfully:
- Installed and configured Argo CD
- Initialized and secured Vault
- Integrated Vault with Kubernetes
- Deployed and connected services

This setup enables secure and scalable GitOps workflows with secret management in Kubernetes.