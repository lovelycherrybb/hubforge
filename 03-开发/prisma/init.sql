-- ============================================================
-- HubForge - PostgreSQL RLS 初始化脚本
-- 适配新 schema：User 全局身份 + UserTenant 租户隔离
-- 此脚本在 Prisma migrate 之后运行
-- ============================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 创建应用角色（用于 RLS 策略）
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_password';
  END IF;
END
$$;

-- ============================================================
-- RLS 辅助函数
-- ============================================================

-- 获取当前租户 ID（从会话变量中读取）
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 检查当前用户是否为全局管理员
CREATE OR REPLACE FUNCTION is_global_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('app.is_global_admin', true)::BOOLEAN;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取当前用户 ID
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.user_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 为业务表启用 RLS 并添加策略
-- 由应用层通过 SET app.tenant_id = '<tenant_id>' 注入租户上下文
-- ============================================================

-- ----------------------------------------------------------
-- users 表：全局用户池，所有已认证用户可读，仅全局管理员可写
-- User 是全局身份，无 tenant_id 字段
-- ----------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY read_all_users ON users
  FOR SELECT USING (TRUE);

CREATE POLICY admin_write_users ON users
  FOR INSERT, UPDATE, DELETE USING (is_global_admin());

-- ----------------------------------------------------------
-- tenants 表：所有已认证用户可读，仅全局管理员可写
-- ----------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

CREATE POLICY read_all_tenants ON tenants
  FOR SELECT USING (TRUE);

CREATE POLICY admin_write_tenants ON tenants
  FOR INSERT, UPDATE, DELETE USING (is_global_admin());

-- ----------------------------------------------------------
-- user_tenants 表：租户隔离的核心边界
-- 用户只能看到自己所属的租户关系，管理员可看本租户所有
-- ----------------------------------------------------------
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants FORCE ROW LEVEL SECURITY;

-- 用户可以看到自己的租户关系
CREATE POLICY read_own_user_tenants ON user_tenants
  FOR SELECT USING (
    user_id = current_user_id()
    OR tenant_id = current_tenant_id()
    OR is_global_admin()
  );

-- 仅租户管理员或全局管理员可写
CREATE POLICY admin_write_user_tenants ON user_tenants
  FOR INSERT, UPDATE, DELETE USING (
    tenant_id = current_tenant_id()
    OR is_global_admin()
  );

-- ----------------------------------------------------------
-- departments 表：租户隔离
-- ----------------------------------------------------------
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_departments ON departments
  USING (tenant_id = current_tenant_id() OR is_global_admin());

CREATE POLICY tenant_write_departments ON departments
  FOR INSERT, UPDATE, DELETE USING (tenant_id = current_tenant_id() OR is_global_admin());

-- ----------------------------------------------------------
-- user_organizations 表：通过 Department 关联进行租户隔离
-- ----------------------------------------------------------
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations FORCE ROW LEVEL SECURITY;

CREATE POLICY read_own_user_organizations ON user_organizations
  FOR SELECT USING (
    user_id = current_user_id()
    OR EXISTS (
      SELECT 1 FROM departments
      WHERE departments.id = user_organizations.organization_id
        AND (departments.tenant_id = current_tenant_id() OR is_global_admin())
    )
  );

CREATE POLICY admin_write_user_organizations ON user_organizations
  FOR INSERT, UPDATE, DELETE USING (
    EXISTS (
      SELECT 1 FROM departments
      WHERE departments.id = user_organizations.organization_id
        AND (departments.tenant_id = current_tenant_id() OR is_global_admin())
    )
  );

-- ----------------------------------------------------------
-- apps 表：租户隔离（apps 现在有 tenant_id）
-- ----------------------------------------------------------
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_apps ON apps
  USING (tenant_id = current_tenant_id() OR is_global_admin());

CREATE POLICY tenant_write_apps ON apps
  FOR INSERT, UPDATE, DELETE USING (tenant_id = current_tenant_id() OR is_global_admin());

-- ----------------------------------------------------------
-- tenant_apps 表：租户隔离
-- ----------------------------------------------------------
ALTER TABLE tenant_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_apps FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tenant_apps ON tenant_apps
  USING (tenant_id = current_tenant_id() OR is_global_admin());

CREATE POLICY tenant_write_tenant_apps ON tenant_apps
  FOR INSERT, UPDATE, DELETE USING (tenant_id = current_tenant_id() OR is_global_admin());

-- ----------------------------------------------------------
-- permissions 表：框架权限全局可见，应用权限租户隔离
-- ----------------------------------------------------------
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_permissions ON permissions
  USING (
    tenant_id IS NULL  -- 框架权限，全局可见
    OR tenant_id = current_tenant_id()
    OR is_global_admin()
  );

CREATE POLICY tenant_write_permissions ON permissions
  FOR INSERT, UPDATE, DELETE USING (
    tenant_id IS NULL
    OR tenant_id = current_tenant_id()
    OR is_global_admin()
  );

-- ----------------------------------------------------------
-- user_permissions 表：直接使用 tenant_id 隔离
-- ----------------------------------------------------------
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_user_permissions ON user_permissions
  USING (
    user_id = current_user_id()
    OR tenant_id = current_tenant_id()
    OR is_global_admin()
  );

CREATE POLICY tenant_write_user_permissions ON user_permissions
  FOR INSERT, UPDATE, DELETE USING (
    tenant_id = current_tenant_id()
    OR is_global_admin()
  );

-- ----------------------------------------------------------
-- department_permissions 表：通过 Department 关联进行租户隔离
-- ----------------------------------------------------------
ALTER TABLE department_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_department_permissions ON department_permissions
  USING (
    EXISTS (
      SELECT 1 FROM departments
      WHERE departments.id = department_permissions.department_id
        AND (departments.tenant_id = current_tenant_id() OR is_global_admin())
    )
  );

CREATE POLICY tenant_write_department_permissions ON department_permissions
  FOR INSERT, UPDATE, DELETE USING (
    EXISTS (
      SELECT 1 FROM departments
      WHERE departments.id = department_permissions.department_id
        AND (departments.tenant_id = current_tenant_id() OR is_global_admin())
    )
  );

-- ----------------------------------------------------------
-- verification_codes 表：租户隔离
-- ----------------------------------------------------------
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_verification_codes ON verification_codes
  USING (tenant_id = current_tenant_id() OR is_global_admin());

CREATE POLICY tenant_write_verification_codes ON verification_codes
  FOR INSERT, UPDATE, DELETE USING (tenant_id = current_tenant_id() OR is_global_admin());

-- ============================================================
-- 授予应用角色权限
-- ============================================================
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
