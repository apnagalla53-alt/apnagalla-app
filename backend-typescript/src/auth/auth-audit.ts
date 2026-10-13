/** Identity events contain no password, reset token, Google credential or email address. */
export async function auditIdentityChange(tx: any, userId: string, action: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { organization_id: true } });
  if (!user?.organization_id) return;
  const roles = await tx.userRole.findMany({ where: { user_id: userId }, select: { company_id: true } });
  const companies = await tx.company.findMany({ where: { id: { in: [...new Set<string>(roles.map((role: any) => role.company_id).filter(Boolean))] }, organization_id: user.organization_id }, select: { id: true } });
  if (companies.length) await tx.auditLog.createMany({ data: companies.map((company: any) => ({ company_id: company.id, user_id: userId, action, source_document_type: 'User', source_document_id: userId })) });
}
