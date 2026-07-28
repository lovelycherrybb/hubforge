// ============================================================
// HubForge - 数据库种子脚本
// 创建初始租户、用户、应用、权限、组织架构
// 全部使用 upsert 保证幂等
// ============================================================

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始创建种子数据...\n");

  // ============================================================
  // 1. 创建全局用户（User - 无密码无租户）
  // ============================================================
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@huajianke.com" },
      update: {},
      create: {
        email: "admin@huajianke.com",
        name: "华检科管理员",
        emailVerified: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "admin@demo.com" },
      update: {},
      create: {
        email: "admin@demo.com",
        name: "示范管理员",
        emailVerified: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "user@demo.com" },
      update: {},
      create: {
        email: "user@demo.com",
        name: "示范用户",
        emailVerified: true,
      },
    }),
  ]);

  const [hjkAdmin, demoAdmin, demoUser] = users;
  console.log(`✅ 用户创建完成: ${users.length} 个`);

  // ============================================================
  // 2. 创建租户（Tenant）
  // ============================================================
  const [mainTenant, demoTenant] = await Promise.all([
    prisma.tenant.upsert({
      where: { slug: "main" },
      update: {},
      create: {
        name: "华检科",
        slug: "main",
        maxUsers: 1000,
        maxApps: 100,
        maxOrgLevels: 10,
        status: "active",
        createdById: hjkAdmin.id,
      },
    }),
    prisma.tenant.upsert({
      where: { slug: "demo" },
      update: {},
      create: {
        name: "示范租户",
        slug: "demo",
        maxUsers: 100,
        maxApps: 20,
        maxOrgLevels: 8,
        status: "active",
        createdById: demoAdmin.id,
      },
    }),
  ]);
  console.log(`✅ 租户创建完成: 华检科(${mainTenant.id}), 示范租户(${demoTenant.id})`);

  // ============================================================
  // 3. 创建用户-租户关系（UserTenant - 含租户独立密码）
  // ============================================================
  const [hjkAdminHash, demoAdminHash, demoUserHash] = await Promise.all([
    bcrypt.hash("Admin@123", 12),
    bcrypt.hash("Demo@123", 12),
    bcrypt.hash("User@123", 12),
  ]);

  const userTenants = await Promise.all([
    prisma.userTenant.upsert({
      where: {
        userId_tenantId: { userId: hjkAdmin.id, tenantId: mainTenant.id },
      },
      update: {},
      create: {
        userId: hjkAdmin.id,
        tenantId: mainTenant.id,
        passwordHash: hjkAdminHash,
        role: "owner",
        status: "active",
      },
    }),
    prisma.userTenant.upsert({
      where: {
        userId_tenantId: { userId: demoAdmin.id, tenantId: demoTenant.id },
      },
      update: {},
      create: {
        userId: demoAdmin.id,
        tenantId: demoTenant.id,
        passwordHash: demoAdminHash,
        role: "admin",
        status: "active",
      },
    }),
    prisma.userTenant.upsert({
      where: {
        userId_tenantId: { userId: demoUser.id, tenantId: demoTenant.id },
      },
      update: {},
      create: {
        userId: demoUser.id,
        tenantId: demoTenant.id,
        passwordHash: demoUserHash,
        role: "member",
        status: "active",
      },
    }),
  ]);
  console.log(`✅ 用户-租户关系创建完成: ${userTenants.length} 个`);

  // ============================================================
  // 4. 创建应用（App - 租户级）
  // ============================================================
  const [hjkInspection, hjkDashboard, demoInspection] = await Promise.all([
    prisma.app.upsert({
      where: { tenantId_slug: { tenantId: mainTenant.id, slug: "inspection" } },
      update: {},
      create: {
        tenantId: mainTenant.id,
        name: "巡检系统",
        slug: "inspection",
        type: "pc",
        description: "设备巡检与维护管理系统",
        url: "/apps/inspection",
        status: "active",
        createdBy: hjkAdmin.id,
      },
    }),
    prisma.app.upsert({
      where: { tenantId_slug: { tenantId: mainTenant.id, slug: "dashboard" } },
      update: {},
      create: {
        tenantId: mainTenant.id,
        name: "数据看板",
        slug: "dashboard",
        type: "pc",
        description: "业务数据可视化看板",
        url: "/apps/dashboard",
        status: "active",
        createdBy: hjkAdmin.id,
      },
    }),
    prisma.app.upsert({
      where: { tenantId_slug: { tenantId: demoTenant.id, slug: "inspection" } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        name: "巡检系统",
        slug: "inspection",
        type: "pc",
        description: "设备巡检与维护管理系统",
        url: "/apps/inspection",
        status: "active",
        createdBy: demoAdmin.id,
      },
    }),
  ]);
  console.log(`✅ 应用创建完成: 华检科(inspection, dashboard), 示范租户(inspection)`);

  // ============================================================
  // 5. 创建租户-应用映射（TenantApp）
  // ============================================================
  const tenantApps = await Promise.all([
    prisma.tenantApp.upsert({
      where: { tenantId_appId: { tenantId: mainTenant.id, appId: hjkInspection.id } },
      update: {},
      create: { tenantId: mainTenant.id, appId: hjkInspection.id, enabled: true },
    }),
    prisma.tenantApp.upsert({
      where: { tenantId_appId: { tenantId: mainTenant.id, appId: hjkDashboard.id } },
      update: {},
      create: { tenantId: mainTenant.id, appId: hjkDashboard.id, enabled: true },
    }),
    prisma.tenantApp.upsert({
      where: { tenantId_appId: { tenantId: demoTenant.id, appId: demoInspection.id } },
      update: {},
      create: { tenantId: demoTenant.id, appId: demoInspection.id, enabled: true },
    }),
  ]);
  console.log(`✅ 租户-应用映射创建完成: ${tenantApps.length} 个`);

  // ============================================================
  // 6. 创建权限（Permission）
  // ============================================================

  // Framework 权限（全局级，tenantId 为 mainTenant.id 以满足唯一约束）
  const frameworkPermDefs = [
    { key: "app.inspection.access", label: "巡检系统访问权限" },
    { key: "app.inspection.featureA", label: "巡检高级功能A" },
    { key: "app.inspection.featureB", label: "巡检高级功能B" },
    { key: "app.dashboard.access", label: "数据看板访问权限" },
  ];

  const createdFrameworkPerms: Record<string, any> = {};
  for (const perm of frameworkPermDefs) {
    const created = await prisma.permission.upsert({
      where: {
        key_tenantId: { key: perm.key, tenantId: mainTenant.id },
      },
      update: {},
      create: {
        key: perm.key,
        label: perm.label,
        type: "framework",
        tenantId: mainTenant.id,
      },
    });
    createdFrameworkPerms[perm.key] = created;
  }

  // App 权限（绑定到具体应用）
  const appPerms = [
    { key: "inspection.submit", label: "巡检提交" },
    { key: "inspection.view", label: "巡检查看" },
  ];

  const createdAppPerms = [];
  for (const perm of appPerms) {
    const created = await prisma.permission.upsert({
      where: {
        key_tenantId: { key: perm.key, tenantId: mainTenant.id },
      },
      update: {},
      create: {
        key: perm.key,
        label: perm.label,
        type: "app",
        tenantId: mainTenant.id,
        appId: hjkInspection.id,
      },
    });
    createdAppPerms.push(created);
  }

  // 给示范租户也创建对应的 app 权限
  const demoAppPerms = [];
  for (const perm of appPerms) {
    const created = await prisma.permission.upsert({
      where: {
        key_tenantId: { key: perm.key, tenantId: demoTenant.id },
      },
      update: {},
      create: {
        key: perm.key,
        label: perm.label,
        type: "app",
        tenantId: demoTenant.id,
        appId: demoInspection.id,
      },
    });
    demoAppPerms.push(created);
  }

  console.log(`✅ 权限创建完成: framework(${Object.keys(createdFrameworkPerms).length}), app(${createdAppPerms.length + demoAppPerms.length})`);

  // ============================================================
  // 6.1 框架权限授予租户（TenantPermission）
  // ============================================================
  // 华检科(owner) 拥有所有框架权限
  for (const perm of Object.values(createdFrameworkPerms)) {
    await prisma.tenantPermission.upsert({
      where: {
        tenantId_permissionId: {
          tenantId: mainTenant.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        tenantId: mainTenant.id,
        permissionId: perm.id,
        grantedBy: hjkAdmin.id,
      },
    });
  }

  // 示范租户 只有 app.inspection.access（只能用巡检系统，没有看板）
  const inspectionAccessPerm = createdFrameworkPerms["app.inspection.access"];
  if (inspectionAccessPerm) {
    await prisma.tenantPermission.upsert({
      where: {
        tenantId_permissionId: {
          tenantId: demoTenant.id,
          permissionId: inspectionAccessPerm.id,
        },
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        permissionId: inspectionAccessPerm.id,
        grantedBy: hjkAdmin.id,
      },
    });
  }

  console.log(`✅ 框架权限授予租户完成: 华检科(全部), 示范租户(巡检系统)`);

  // ============================================================
  // 7. 创建部门 + 用户组织关系
  // ============================================================
  // 华检科根部门
  const hjkRootDept = await prisma.department.upsert({
    where: { id: "hjk-root-dept" },
    update: {},
    create: {
      id: "hjk-root-dept",
      name: "华检科",
      tenantId: mainTenant.id,
      sortOrder: 0,
    },
  });

  // 华检科子部门
  const hjkTechDept = await prisma.department.upsert({
    where: { id: "hjk-tech-dept" },
    update: {},
    create: {
      id: "hjk-tech-dept",
      name: "技术部",
      tenantId: mainTenant.id,
      parentId: hjkRootDept.id,
      sortOrder: 1,
    },
  });

  // 示范租户根部门
  const demoRootDept = await prisma.department.upsert({
    where: { id: "demo-root-dept" },
    update: {},
    create: {
      id: "demo-root-dept",
      name: "示范公司",
      tenantId: demoTenant.id,
      sortOrder: 0,
    },
  });

  // 用户组织关系
  await Promise.all([
    prisma.userOrganization.upsert({
      where: {
        userId_organizationId: { userId: hjkAdmin.id, organizationId: hjkRootDept.id },
      },
      update: {},
      create: { userId: hjkAdmin.id, organizationId: hjkRootDept.id, isPrimary: true },
    }),
    prisma.userOrganization.upsert({
      where: {
        userId_organizationId: { userId: demoAdmin.id, organizationId: demoRootDept.id },
      },
      update: {},
      create: { userId: demoAdmin.id, organizationId: demoRootDept.id, isPrimary: true },
    }),
    prisma.userOrganization.upsert({
      where: {
        userId_organizationId: { userId: demoUser.id, organizationId: demoRootDept.id },
      },
      update: {},
      create: { userId: demoUser.id, organizationId: demoRootDept.id, isPrimary: true },
    }),
  ]);
  console.log(`✅ 部门与组织关系创建完成`);

  // ============================================================
  // 8. 给管理员分配权限
  // ============================================================
  const allPerms = await prisma.permission.findMany({
    where: { tenantId: mainTenant.id },
  });

  for (const perm of allPerms) {
    await prisma.userPermission.upsert({
      where: {
        userId_tenantId_permissionId: {
          userId: hjkAdmin.id,
          tenantId: mainTenant.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        userId: hjkAdmin.id,
        tenantId: mainTenant.id,
        permissionId: perm.id,
        grantedBy: hjkAdmin.id,
      },
    });
  }

  // 给示范管理员分配巡检权限
  const inspectionViewPerm = await prisma.permission.findFirst({
    where: { key: "inspection.view", tenantId: demoTenant.id },
  });
  if (inspectionViewPerm) {
    await prisma.userPermission.upsert({
      where: {
        userId_tenantId_permissionId: {
          userId: demoAdmin.id,
          tenantId: demoTenant.id,
          permissionId: inspectionViewPerm.id,
        },
      },
      update: {},
      create: {
        userId: demoAdmin.id,
        tenantId: demoTenant.id,
        permissionId: inspectionViewPerm.id,
        grantedBy: demoAdmin.id,
      },
    });
  }

  console.log(`✅ 权限分配完成`);

  // ============================================================
  // 打印摘要
  // ============================================================
  console.log("\n🎉 种子数据创建完成！\n");
  console.log("📋 登录信息:");
  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│ 华检科 (main)                                           │");
  console.log("│   admin@huajianke.com / Admin@123 (owner)               │");
  console.log("├─────────────────────────────────────────────────────────┤");
  console.log("│ 示范租户 (demo)                                         │");
  console.log("│   admin@demo.com / Demo@123 (admin)                     │");
  console.log("│   user@demo.com / User@123 (member)                     │");
  console.log("└─────────────────────────────────────────────────────────┘");
}

main()
  .catch((e) => {
    console.error("❌ 种子数据创建失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
