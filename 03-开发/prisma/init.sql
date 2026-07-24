-- ============================================================
-- HubForge - PostgreSQL RLS 初始化脚本
-- 此脚本在 Docker 容器首次启动时自动执行
-- ============================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 创建应用角色（用于 RLS 策略）
-- ============================================================

-- 应用角色，Prisma 连接时使用此角色
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

-- ============================================================
-- 为业务表启用 RLS 并添加策略
-- 注意：需要在 Prisma migrate 之后运行此部分
-- ============================================================

-- 以下策略在表创建后启用
-- 由应用层通过 SET app.tenant_id = '<tenant_id>' 注入租户上下文

-- 用户表 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_tenant_id() OR is_global_admin());

-- 部门表 RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_departments ON departments
  USING (tenant_id = current_tenant_id() OR is_global_admin());

-- 租户配置表 RLS
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenant_configs ON tenant_configs
  USING (tenant_id = current_tenant_id() OR is_global_admin());

-- 应用表 RLS
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_apps ON apps
  USING (tenant_id = current_tenant_id() OR is_global_admin());

-- 应用配置表 RLS（通过 App 关联）
ALTER TABLE app_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_app_configs ON app_configs
  USING (
    EXISTS (
      SELECT 1 FROM apps
      WHERE apps.id = app_configs.app_id
        AND (apps.tenant_id = current_tenant_id() OR is_global_admin())
    )
  );

-- 权限表 RLS（框架权限全局可见，应用权限租户隔离）
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_permissions ON permissions
  USING (
    tenant_id IS NULL  -- 框架权限，全局可见
    OR tenant_id = current_tenant_id()
    OR is_global_admin()
  );

-- 用户权限表 RLS（通过 User 关联）
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_user_permissions ON user_permissions
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = user_permissions.user_id
        AND (users.tenant_id = current_tenant_id() OR is_global_admin())
    )
  );

-- 部门权限表 RLS（通过 Department 关联）
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

-- 授予应用角色权限
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
