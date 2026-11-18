@echo off
title Deploy FARMLY to Red Hat OpenShift
cd /d "%~dp0"

echo ========================================================================
echo             DEPLOY FARMLY TO RED HAT OPENSHIFT
echo ========================================================================
echo.
echo Checking for OpenShift CLI (oc)...
where oc >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] OpenShift CLI 'oc' was not found in your PATH.
    echo Please install it or login to the OpenShift Web Console.
    echo To install via winget: winget install RedHat.OpenShift-Client
    pause
    exit /b 1
)

echo.
echo 1. Creating or switching to project 'farmly'...
call oc new-project farmly 2>nul || call oc project farmly

echo.
echo 2. Applying ImageStream and BuildConfig...
call oc apply -f openshift/buildconfig.yaml

echo.
echo 3. Applying Storage PVC, Deployment, Service, and Route...
call oc apply -f openshift/all-in-one.yaml

echo.
echo 4. Uploading files and building container inside OpenShift...
call oc start-build farmly --from-dir=. --follow

echo.
echo ========================================================================
echo Deployment Complete! Live OpenShift Route URL:
echo ========================================================================
call oc get route farmly
echo.
pause
