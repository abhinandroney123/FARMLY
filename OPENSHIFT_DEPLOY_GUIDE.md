# Deploying FARMLY to Red Hat OpenShift

This repository is fully configured for **Red Hat OpenShift** with:
- Red Hat Certified Universal Base Image (**UBI 9 Node.js 20**)
- Persistent Volume Claim (**PVC**) so your farm data is never lost across pod restarts
- OpenShift **Service** and **Route** with automatic HTTPS / SSL encryption
- Pre-configured manifests in [`openshift/`](openshift/)

---

## Method 1: Using OpenShift Web Console (Easiest & Visual)

If you have access to your Red Hat OpenShift Web Console in your browser:

### Step 1: Log in and Switch to Developer View
1. Open your OpenShift Web Console in Chrome or Edge.
2. In the top-left dropdown, switch from **Administrator** to **Developer** perspective.
3. Click the **Project** dropdown and select **Create Project** -> name it `farmly`.

### Step 2: Deploy Using the Pre-configured YAML
1. In the top-right toolbar, click the **`+` (Import YAML)** icon.
2. Copy the contents of [`openshift/all-in-one.yaml`](openshift/all-in-one.yaml) and paste it into the editor.
3. Click **Create**.
   - This automatically creates your **Persistent Storage (PVC)**, **Service**, and **Public HTTPS Route**.

### Step 3: Build the Image
* If your code is on GitHub / GitLab:
  - Click **+Add** -> **From Git** -> enter your Git URL -> select **Node.js** builder -> click **Create**.
* If building directly from your local files, follow **Method 2** below.

---

## Method 2: Deploy from Terminal / CLI (1-Click Automated)

### Step 1: Install OpenShift CLI (`oc`)
If you don't have `oc` installed yet, run in PowerShell:
```powershell
winget install RedHat.OpenShift-Client
```
*(Restart your terminal after installation).*

### Step 2: Log In to Your OpenShift Cluster
1. In your OpenShift Web Console, click your username in the top-right corner.
2. Click **Copy login command** -> click **Display Token**.
3. Copy the `oc login` command and run it in PowerShell, for example:
```powershell
oc login --token=sha256~xxxxxx --server=https://api.your-cluster.openshift.com:6443
```

### Step 3: Run the 1-Click Deployment Script
Simply double-click:
```
deploy-to-openshift.bat
```
Or run in PowerShell:
```powershell
cd "c:\Users\abhinand roney\Downloads\FARMLY_poultry_farm_management\FARMLY"
.\deploy-to-openshift.bat
```

This will automatically:
1. Create or switch to project `farmly`.
2. Apply the OpenShift ImageStream and BuildConfig.
3. Create the Persistent Volume Claim (1Gi storage for data).
4. Upload your local files and build the container inside OpenShift.
5. Create the Service and Route, printing your live **`https://farmly-farmly.apps...`** URL!
