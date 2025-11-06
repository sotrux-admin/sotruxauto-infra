# Guía: Configurar Secrets en GitHub

Esta guía te llevará paso a paso para configurar los secrets necesarios en GitHub para que los workflows de despliegue automático funcionen correctamente.

---

## 📋 Información Requerida

Antes de empezar, necesitas tener:

- ✅ Account ID de AWS para dev: `387761228258`
- ⏳ Account ID de AWS para staging: `_______________`
- ⏳ Account ID de AWS para producción: `_______________`
- ✅ Acceso de administrador al repositorio GitHub: `sotrux-admin/sotruxauto-infra`

---

## 🚀 Paso 1: Acceder a la Configuración de Secrets

1. Abre tu navegador y ve a: https://github.com/sotrux-admin/sotruxauto-infra
2. Haz clic en **Settings** (arriba a la derecha del repositorio)
3. En el menú izquierdo, ve a **Secrets and variables** → **Actions**
4. Verás dos pestañas:
   - **Secrets**: Para información sensible (como Account IDs)
   - **Variables**: Para información no sensible (opcional)

---

## 🔐 Paso 2: Configurar Secrets para Dev

### 2.1 Secret: AWS_ACCOUNT_ID_DEV

1. En la página de Secrets, haz clic en **New repository secret**
2. Completa el formulario:
   - **Name**: `AWS_ACCOUNT_ID_DEV`
   - **Secret**: `387761228258`
3. Haz clic en **Add secret**

✅ **Verificación**: Deberías ver `AWS_ACCOUNT_ID_DEV` en la lista de secrets.

---

## 🔐 Paso 3: Configurar Secrets para Staging (Opcional - cuando tengas la cuenta)

### 3.1 Secret: AWS_ACCOUNT_ID_STG

1. Haz clic en **New repository secret**
2. Completa el formulario:
   - **Name**: `AWS_ACCOUNT_ID_STG`
   - **Secret**: `[TU_ACCOUNT_ID_STG]` (reemplaza con el Account ID real)
3. Haz clic en **Add secret**

**Nota**: Este secret solo es necesario cuando tengas la cuenta de staging lista.

---

## 🔐 Paso 4: Configurar Secrets para Producción (Opcional - cuando tengas la cuenta)

### 4.1 Secret: AWS_ACCOUNT_ID_PROD

1. Haz clic en **New repository secret**
2. Completa el formulario:
   - **Name**: `AWS_ACCOUNT_ID_PROD`
   - **Secret**: `[TU_ACCOUNT_ID_PROD]` (reemplaza con el Account ID real)
3. Haz clic en **Add secret**

**Nota**: Este secret solo es necesario cuando tengas la cuenta de producción lista.

---

## 🔐 Paso 5: Secret Opcional para Bootstrap (Opcional)

Si planeas usar el workflow de bootstrap desde GitHub Actions, necesitarás un role temporal para bootstrap.

### 5.1 Secret: AWS_BOOTSTRAP_ROLE_ARN (Opcional)

**Solo si planeas hacer bootstrap desde GitHub Actions:**

1. Crea un role temporal de administrador en AWS (o usa el usuario que creaste)
2. Haz clic en **New repository secret**
3. Completa el formulario:
   - **Name**: `AWS_BOOTSTRAP_ROLE_ARN`
   - **Secret**: `arn:aws:iam::387761228258:role/[ROLE_NAME]` (o el ARN del role)
4. Haz clic en **Add secret**

**Nota**: Si no configuras este secret, el bootstrap deberá hacerse manualmente desde local.

---

## ✅ Paso 6: Verificar Secrets Configurados

Al finalizar, deberías tener al menos estos secrets:

| Secret Name | Valor | Estado |
|------------|-------|--------|
| `AWS_ACCOUNT_ID_DEV` | `387761228258` | ✅ Requerido |
| `AWS_ACCOUNT_ID_STG` | `[TU_ACCOUNT_ID]` | ⏳ Opcional (futuro) |
| `AWS_ACCOUNT_ID_PROD` | `[TU_ACCOUNT_ID]` | ⏳ Opcional (futuro) |
| `AWS_BOOTSTRAP_ROLE_ARN` | `[ARN]` | ⏳ Opcional |

---

## 📝 Paso 7: Verificar que los Secrets Están Protegidos

**Importante**: Los secrets son sensibles y no deben compartirse.

1. Verifica que los secrets tienen el icono de candado 🔒
2. Los secrets están encriptados y solo se pueden usar en GitHub Actions
3. No puedes ver el valor una vez guardado (solo puedes actualizarlo o eliminarlo)

---

## 🧪 Paso 8: Probar el Workflow (Opcional)

Una vez configurados los secrets, puedes probar el workflow:

1. Ve a la pestaña **Actions** en GitHub
2. Selecciona el workflow **Deploy Infrastructure - Dev**
3. Haz clic en **Run workflow** (botón derecho)
4. Selecciona:
   - **Branch**: `dev` (o `feature/IAC-000` si aún no existe `dev`)
   - **Action**: `validate`
5. Haz clic en **Run workflow**

**Resultado esperado**: El workflow debería ejecutarse y completar la validación sin errores.

---

## 🔍 Troubleshooting

### Error: "Secret not found"
- Verifica que el nombre del secret sea exacto (case-sensitive)
- Asegúrate de estar en el repositorio correcto
- Verifica que tengas permisos de administrador

### Error: "Role cannot be assumed"
- Verifica que el GitHub OIDC role existe en AWS
- Verifica que el trust policy del role permite el repositorio/branch correcto
- El role debe estar en la misma cuenta que el secret `AWS_ACCOUNT_ID_DEV`

### Error: "Account ID mismatch"
- Verifica que el Account ID en el secret coincida con la cuenta donde desplegaste los stacks
- El Account ID debe ser el mismo que usaste para el despliegue manual

---

## 📚 Referencias

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)

---

## ✅ Checklist Final

- [ ] `AWS_ACCOUNT_ID_DEV` configurado
- [ ] Secrets verificados en la lista
- [ ] Workflow de validación probado (opcional)
- [ ] Documentación leída y entendida

---

**¡Listo!** Una vez configurados los secrets, los workflows de GitHub Actions podrán desplegar automáticamente cuando hagas push a los branches correspondientes.

