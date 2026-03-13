import type { Task, AuditEntry, CheckIn, HandoffRecord, Team, Employee, Role, AvailabilityRecord } from '../types';
import { getToday } from '../utils/date';
import { CATEGORIES_BY_INDUSTRY } from '../constants/categories';

// ── Team generation helper ──────────────────────────────────────────────

interface TeamDef {
  name: string;
  color: string;
  leadName: string;
  memberNames: string[];
}

export function generateTeams(defs: TeamDef[], wsPrefix: string): Team[] {
  let empIdx = 1;
  return defs.map((def, tIdx) => {
    const teamId = `${wsPrefix}t${tIdx + 1}`;
    const leadId = `${wsPrefix}e${empIdx}`;
    empIdx++;
    const lead: Employee = {
      id: leadId,
      name: def.leadName,
      role: 'subadmin' as Role,
      teamId,
      teamName: def.name,
    };
    const members: Employee[] = def.memberNames.map((name) => {
      const id = `${wsPrefix}e${empIdx}`;
      empIdx++;
      return {
        id,
        name,
        role: 'employee' as Role,
        teamId,
        teamName: def.name,
      };
    });
    return { id: teamId, name: def.name, color: def.color, lead, members };
  });
}

// ── Seed data generation ─────────────────────────────────────────────────

export function generateSeedData(
  industryId: string,
  sites: { id: string; name: string }[],
  adminName: string,
  teams?: Team[],
) {
  const today = getToday();
  const yesterday = offsetDate(today, -1);
  const twoDaysAgo = offsetDate(today, -2);
  const threeDaysAgo = offsetDate(today, -3);
  const fourDaysAgo = offsetDate(today, -4);
  const fiveDaysAgo = offsetDate(today, -5);
  const tomorrow = offsetDate(today, 1);
  const threeDaysOut = offsetDate(today, 3);
  const fiveDaysOut = offsetDate(today, 5);
  const sevenDaysOut = offsetDate(today, 7);

  const cn = CATEGORIES_BY_INDUSTRY[industryId] || [];
  const tasks: Task[] = [];
  const audit: AuditEntry[] = [];

  // Use team members from provided teams, with fallbacks for Apex backward compat
  const t1m = teams?.[0]?.members || [];
  const t2m = teams?.[1]?.members || [];
  const t3m = teams?.[2]?.members || [];
  const t1Id = teams?.[0]?.id || 't1';
  const t2Id = teams?.[1]?.id || 't2';
  const t3Id = teams?.[2]?.id || 't3';

  const emp = (t: Employee | undefined, fallbackId: string, fallbackName: string) =>
    t ? { id: t.id, name: t.name } : { id: fallbackId, name: fallbackName };

  const e4 = emp(t1m[0], 'e4', 'John Doe');
  const e5 = emp(t1m[1], 'e5', 'Mary Smith');
  const e6 = emp(t1m[2], 'e6', 'Chidi Nwankwo');
  const e7 = emp(t1m[3], 'e7', 'Bola Adeyemi');
  const e8 = emp(t1m[4], 'e8', 'Fatima Yusuf');
  const e9 = emp(t1m[5], 'e9', 'Emeka Obi');
  const e14 = emp(t2m[0], 'e14', 'Blessing Okoro');
  const e15 = emp(t2m[1], 'e15', 'Yemi Alade');
  const e16 = emp(t2m[2], 'e16', 'Samuel Okon');
  const e17 = emp(t2m[3], 'e17', 'Grace Udo');
  const e18 = emp(t2m[4], 'e18', 'Ibrahim Musa');
  const e19 = emp(t2m[5], 'e19', 'Amaka Nwosu');
  const e24 = emp(t3m[0], 'e24', 'Musa Garba');
  const e25 = emp(t3m[1], 'e25', 'Rita Okafor');
  const e26 = emp(t3m[2], 'e26', 'Yakubu Danjuma');
  const e27 = emp(t3m[3], 'e27', 'Ifeoma Chukwu');
  const e28 = emp(t3m[4], 'e28', 'Segun Adeniyi');
  const e29 = emp(t3m[5], 'e29', 'Hauwa Abubakar');

  const lead1 = teams?.[0]?.lead ? { id: teams[0].lead.id, name: teams[0].lead.name } : { id: 'e1', name: 'Gregory James' };
  const lead2 = teams?.[1]?.lead ? { id: teams[1].lead.id, name: teams[1].lead.name } : { id: 'e2', name: 'Michael Ade' };
  const lead3 = teams?.[2]?.lead ? { id: teams[2].lead.id, name: teams[2].lead.name } : { id: 'e3', name: 'Samuel Obi' };

  // ID prefix to avoid collision across workspaces
  const idPrefix = teams ? `${teams[0]?.id?.replace(/t\d+$/, '') || ''}` : '';
  const tid = (n: string) => `${idPrefix}${n}`;
  const aid = (n: string) => `${idPrefix}a${n}`;

  if (sites.length >= 1) {
    tasks.push(
      {
        id: tid('201'), title: `${cn[0]} — Unit A`, site: sites[0].name, siteId: sites[0].id,
        category: cn[0], priority: 'medium', due: threeDaysOut, assignee: e4.name,
        assigneeId: e4.id, teamId: t1Id, status: 'Open', assignedBy: adminName,
        assignedByRole: 'admin', approved: true, createdAt: yesterday,
        lastActivityAt: yesterday,
      },
      {
        id: tid('202'), title: `${cn[1]} — Lobby`, site: sites[0].name, siteId: sites[0].id,
        category: cn[1], priority: 'critical', due: yesterday, assignee: e5.name,
        assigneeId: e5.id, teamId: t1Id, status: 'In Progress', assignedBy: lead1.name,
        assignedByRole: 'subadmin', approved: true, createdAt: twoDaysAgo, startedAt: yesterday,
        lastActivityAt: yesterday,
      },
      {
        id: tid('207'), title: `${cn[0]} — pending`, site: sites[0].name, siteId: sites[0].id,
        category: cn[0], priority: 'low', due: fiveDaysOut, assignee: e4.name,
        assigneeId: e4.id, teamId: t1Id, status: 'Pending Approval', assignedBy: '',
        assignedByRole: 'employee', approved: false, createdAt: today,
        lastActivityAt: today,
      },
    );

    tasks.push({
      id: tid('37'), title: `${cn[2]} — recurring leak`, site: sites[0].name, siteId: sites[0].id,
      category: cn[2], priority: 'critical', due: fiveDaysAgo, assignee: e5.name,
      assigneeId: e5.id, teamId: t1Id, status: 'In Progress', assignedBy: adminName,
      assignedByRole: 'admin', approved: true, createdAt: fiveDaysAgo,
      reworked: true, reworkCount: 3, lastActivityAt: twoDaysAgo,
    });

    tasks.push(
      {
        id: tid('208'), title: `${cn[4] || cn[0]} — Floor 3`, site: sites[0].name, siteId: sites[0].id,
        category: cn[4] || cn[0], priority: 'low', due: sevenDaysOut, assignee: e6.name,
        assigneeId: e6.id, teamId: t1Id, status: 'Open', assignedBy: adminName,
        assignedByRole: 'admin', approved: true, createdAt: today,
        lastActivityAt: today,
      },
      {
        id: tid('209'), title: `${cn[1]} — Basement`, site: sites[0].name, siteId: sites[0].id,
        category: cn[1], priority: 'medium', due: tomorrow, assignee: e7.name,
        assigneeId: e7.id, teamId: t1Id, status: 'In Progress', assignedBy: lead1.name,
        assignedByRole: 'subadmin', approved: true, createdAt: threeDaysAgo, startedAt: yesterday,
        lastActivityAt: yesterday,
      },
      {
        id: tid('210'), title: `${cn[0]} — Roof deck`, site: sites[0].name, siteId: sites[0].id,
        category: cn[0], priority: 'critical', due: twoDaysAgo, assignee: e8.name,
        assigneeId: e8.id, teamId: t1Id, status: 'Completed', assignedBy: adminName,
        assignedByRole: 'admin', approved: true, createdAt: fourDaysAgo, startedAt: threeDaysAgo,
        completedAt: yesterday, lastActivityAt: yesterday,
      },
      {
        id: tid('211'), title: `${cn[2]} — Parking P2`, site: sites[0].name, siteId: sites[0].id,
        category: cn[2], priority: 'low', due: fiveDaysAgo, assignee: e9.name,
        assigneeId: e9.id, teamId: t1Id, status: 'Verified', assignedBy: adminName,
        assignedByRole: 'admin', approved: true, createdAt: offsetDate(today, -8),
        completedAt: threeDaysAgo, verifiedBy: adminName, lastActivityAt: twoDaysAgo,
      },
    );

    audit.push(
      { id: aid('1'), taskId: tid('201'), role: 'System', message: `Task assigned to ${e4.name} by ${adminName}.`, createdAt: `${yesterday}T09:00:00Z`, dateTag: yesterday, updateType: 'Assignment' },
      { id: aid('2'), taskId: tid('202'), role: 'System', message: `Task assigned to ${e5.name} by ${lead1.name}.`, createdAt: `${twoDaysAgo}T10:00:00Z`, dateTag: twoDaysAgo, updateType: 'Assignment' },
      { id: aid('3'), taskId: tid('202'), role: 'Employee', message: 'Started inspection. Vendor confirmed for tomorrow.', createdAt: `${yesterday}T14:00:00Z`, dateTag: yesterday, updateType: 'Progress Update' },
      { id: aid('4'), taskId: tid('202'), role: 'System', message: `▶ Task started on ${yesterday} by ${e5.name}.`, createdAt: `${yesterday}T14:01:00Z`, dateTag: yesterday, updateType: 'Status' },
      { id: aid('5'), taskId: tid('37'), role: 'Admin', message: 'Rework requested by Admin: Quality not up to standard. Cycle 1.', createdAt: `${fourDaysAgo}T09:00:00Z`, dateTag: fourDaysAgo, updateType: 'Rework' },
      { id: aid('6'), taskId: tid('37'), role: 'SubAdmin', message: `Rework requested by ${lead1.name}: Still leaking. Cycle 2.`, createdAt: `${threeDaysAgo}T10:00:00Z`, dateTag: threeDaysAgo, updateType: 'Rework' },
      { id: aid('7'), taskId: tid('37'), role: 'Admin', message: 'Rework requested by Admin: Third attempt needed. Cycle 3.', createdAt: `${twoDaysAgo}T08:00:00Z`, dateTag: twoDaysAgo, updateType: 'Rework' },
      { id: aid('8'), taskId: tid('37'), role: 'System', message: '⚠ Escalated to CRITICAL after 3 rework cycles.', createdAt: `${twoDaysAgo}T08:01:00Z`, dateTag: twoDaysAgo, updateType: 'Escalation' },
    );
  }

  if (sites.length >= 2) {
    tasks.push(
      {
        id: tid('204'), title: `${cn[3] || cn[0]} — Main hall`, site: sites[1].name, siteId: sites[1].id,
        category: cn[3] || cn[0], priority: 'medium', due: sevenDaysOut, assignee: e14.name,
        assigneeId: e14.id, teamId: t2Id, status: 'Open', assignedBy: adminName,
        assignedByRole: 'admin', approved: true, createdAt: yesterday,
        lastActivityAt: yesterday,
      },
      {
        id: tid('205'), title: `${cn[0]} — done`, site: sites[1].name, siteId: sites[1].id,
        category: cn[0], priority: 'medium', due: yesterday, assignee: e15.name,
        assigneeId: e15.id, teamId: t2Id, status: 'Completed', assignedBy: lead2.name,
        assignedByRole: 'subadmin', approved: true, createdAt: twoDaysAgo, completedAt: yesterday,
        lastActivityAt: yesterday,
      },
      {
        id: tid('206'), title: `${cn[5] || cn[0]} — Gate B`, site: sites[0].name, siteId: sites[0].id,
        category: cn[5] || cn[0], priority: 'medium', due: fiveDaysOut, assignee: e24.name,
        assigneeId: e24.id, teamId: t3Id, status: 'Open', assignedBy: adminName,
        assignedByRole: 'admin', approved: true, createdAt: yesterday,
        lastActivityAt: yesterday,
      },
    );

    tasks.push(
      {
        id: tid('212'), title: `${cn[1]} — East wing`, site: sites[1].name, siteId: sites[1].id,
        category: cn[1], priority: 'critical', due: today, assignee: e16.name,
        assigneeId: e16.id, teamId: t2Id, status: 'In Progress', assignedBy: lead2.name,
        assignedByRole: 'subadmin', approved: true, createdAt: threeDaysAgo, startedAt: twoDaysAgo,
        lastActivityAt: twoDaysAgo,
      },
      {
        id: tid('213'), title: `${cn[0]} — Reception`, site: sites[1].name, siteId: sites[1].id,
        category: cn[0], priority: 'low', due: threeDaysOut, assignee: e17.name,
        assigneeId: e17.id, teamId: t2Id, status: 'Open', assignedBy: adminName,
        assignedByRole: 'admin', approved: true, createdAt: yesterday,
        lastActivityAt: yesterday,
      },
      {
        id: tid('214'), title: `${cn[3] || cn[0]} — Perimeter`, site: sites[1].name, siteId: sites[1].id,
        category: cn[3] || cn[0], priority: 'medium', due: threeDaysAgo, assignee: e25.name,
        assigneeId: e25.id, teamId: t3Id, status: 'In Progress', assignedBy: lead3.name,
        assignedByRole: 'subadmin', approved: true, createdAt: fiveDaysAgo, startedAt: fourDaysAgo,
        lastActivityAt: fourDaysAgo,
      },
      {
        id: tid('215'), title: `${cn[5] || cn[0]} — Stairwell B`, site: sites[0].name, siteId: sites[0].id,
        category: cn[5] || cn[0], priority: 'medium', due: offsetDate(today, -6), assignee: e26.name,
        assigneeId: e26.id, teamId: t3Id, status: 'Verified', assignedBy: adminName,
        assignedByRole: 'admin', approved: true, createdAt: offsetDate(today, -10),
        completedAt: offsetDate(today, -7), verifiedBy: adminName, lastActivityAt: offsetDate(today, -6),
      },
      {
        id: tid('216'), title: `${cn[4] || cn[0]} — Corridor L2`, site: sites[1].name, siteId: sites[1].id,
        category: cn[4] || cn[0], priority: 'low', due: fiveDaysOut, assignee: e18.name,
        assigneeId: e18.id, teamId: t2Id, status: 'Pending Approval', assignedBy: '',
        assignedByRole: 'employee', approved: false, createdAt: yesterday,
        lastActivityAt: yesterday,
      },
      {
        id: tid('217'), title: `${cn[2]} — Generator room`, site: sites[0].name, siteId: sites[0].id,
        category: cn[2], priority: 'critical', due: tomorrow, assignee: e27.name,
        assigneeId: e27.id, teamId: t3Id, status: 'In Progress', assignedBy: lead3.name,
        assignedByRole: 'subadmin', approved: true, createdAt: twoDaysAgo, startedAt: yesterday,
        lastActivityAt: yesterday,
      },
      {
        id: tid('218'), title: `${cn[0]} — Loading bay`, site: sites[1].name, siteId: sites[1].id,
        category: cn[0], priority: 'medium', due: fiveDaysOut, assignee: e28.name,
        assigneeId: e28.id, teamId: t3Id, status: 'Open', assignedBy: adminName,
        assignedByRole: 'admin', approved: true, createdAt: today,
        lastActivityAt: today,
      },
      {
        id: tid('219'), title: `${cn[3] || cn[0]} — Elevator shaft`, site: sites[0].name, siteId: sites[0].id,
        category: cn[3] || cn[0], priority: 'low', due: sevenDaysOut, assignee: e19.name,
        assigneeId: e19.id, teamId: t2Id, status: 'Completed', assignedBy: lead2.name,
        assignedByRole: 'subadmin', approved: true, createdAt: fourDaysAgo,
        startedAt: threeDaysAgo, completedAt: yesterday, lastActivityAt: yesterday,
      },
      {
        id: tid('220'), title: `${cn[1]} — West entrance`, site: sites[1].name, siteId: sites[1].id,
        category: cn[1], priority: 'medium', due: threeDaysAgo, assignee: e29.name,
        assigneeId: e29.id, teamId: t3Id, status: 'Verified', assignedBy: lead3.name,
        assignedByRole: 'subadmin', approved: true, createdAt: offsetDate(today, -9),
        completedAt: fourDaysAgo, verifiedBy: adminName, lastActivityAt: threeDaysAgo,
      },
    );
  }

  // ── Delegation chain demo tasks ──────────────────────────────────────
  if (sites.length >= 1) {
    tasks.push({
      id: tid('301'), title: `${cn[0]} — HVAC audit`, site: sites[0].name, siteId: sites[0].id,
      category: cn[0], priority: 'medium', due: fiveDaysOut, assignee: e4.name,
      assigneeId: e4.id, teamId: t1Id, status: 'In Progress', assignedBy: adminName,
      assignedByRole: 'admin', approved: true, createdAt: threeDaysAgo,
      startedAt: twoDaysAgo, lastActivityAt: twoDaysAgo,
      accountableLeadId: lead1.id, delegatedAt: `${twoDaysAgo}T10:00:00Z`,
    });
    audit.push(
      { id: aid('301'), taskId: tid('301'), role: 'System', message: `Task assigned to ${lead1.name} by ${adminName}.`, createdAt: `${threeDaysAgo}T09:00:00Z`, dateTag: threeDaysAgo, updateType: 'Assignment' },
      { id: aid('302'), taskId: tid('301'), role: 'SubAdmin', message: `Delegated to ${e4.name} by ${lead1.name}.`, createdAt: `${twoDaysAgo}T10:00:00Z`, dateTag: twoDaysAgo, updateType: 'Delegated' },
      { id: aid('303'), taskId: tid('301'), role: 'Employee', message: 'Started inspection.', createdAt: `${twoDaysAgo}T11:00:00Z`, dateTag: twoDaysAgo, updateType: 'Status' },
    );

    tasks.push({
      id: tid('302'), title: `${cn[1]} — Deep clean scheduling`, site: sites[0].name, siteId: sites[0].id,
      category: cn[1], priority: 'low', due: sevenDaysOut, assignee: lead2.name,
      assigneeId: lead2.id, teamId: t2Id, status: 'Open', assignedBy: adminName,
      assignedByRole: 'admin', approved: true, createdAt: yesterday,
      lastActivityAt: yesterday,
      accountableLeadId: lead2.id,
    });
    audit.push(
      { id: aid('304'), taskId: tid('302'), role: 'System', message: `Task assigned to ${lead2.name} by ${adminName}.`, createdAt: `${yesterday}T09:00:00Z`, dateTag: yesterday, updateType: 'Assignment' },
    );

    tasks.push({
      id: tid('303'), title: `${cn[5] || cn[0]} — Gate sensor fix`, site: sites[0].name, siteId: sites[0].id,
      category: cn[5] || cn[0], priority: 'medium', due: yesterday, assignee: e24.name,
      assigneeId: e24.id, teamId: t3Id, status: 'Completed', assignedBy: adminName,
      assignedByRole: 'admin', approved: true, createdAt: fourDaysAgo,
      startedAt: threeDaysAgo, completedAt: yesterday, lastActivityAt: yesterday,
      accountableLeadId: lead3.id, delegatedAt: `${threeDaysAgo}T09:00:00Z`,
    });
    audit.push(
      { id: aid('305'), taskId: tid('303'), role: 'System', message: `Task assigned to ${lead3.name} by ${adminName}.`, createdAt: `${fourDaysAgo}T09:00:00Z`, dateTag: fourDaysAgo, updateType: 'Assignment' },
      { id: aid('306'), taskId: tid('303'), role: 'SubAdmin', message: `Delegated to ${e24.name} by ${lead3.name}.`, createdAt: `${threeDaysAgo}T09:00:00Z`, dateTag: threeDaysAgo, updateType: 'Delegated' },
      { id: aid('307'), taskId: tid('303'), role: 'Employee', message: 'Gate sensor replaced and tested.', createdAt: `${yesterday}T15:00:00Z`, dateTag: yesterday, updateType: 'Status' },
    );
  }

  // ── Stalled task demo ──────────────────────────────────────────────────
  if (sites.length >= 1) {
    tasks.push({
      id: tid('401'), title: `${cn[2]} — Paint touch-up corridor`, site: sites[0].name, siteId: sites[0].id,
      category: cn[2], priority: 'low', due: sevenDaysOut, assignee: e7.name,
      assigneeId: e7.id, teamId: t1Id, status: 'In Progress', assignedBy: lead1.name,
      assignedByRole: 'subadmin', approved: true, createdAt: offsetDate(today, -6),
      startedAt: fiveDaysAgo, lastActivityAt: fiveDaysAgo,
      lastNoChangeAt: yesterday,
    });
    const noChangeDays = getRecentWorkdays(today, 4);
    noChangeDays.forEach((day, i) => {
      audit.push({
        id: aid(`401_${i}`), taskId: tid('401'), role: 'Employee',
        message: `No change reported by ${e7.name}.`,
        createdAt: `${day}T09:00:00Z`, dateTag: day, updateType: 'No Change',
      });
    });

    tasks.push({
      id: tid('402'), title: `${cn[0]} — Fire extinguisher check`, site: sites[0].name, siteId: sites[0].id,
      category: cn[0], priority: 'medium', due: threeDaysOut, assignee: e6.name,
      assigneeId: e6.id, teamId: t1Id, status: 'Open', assignedBy: adminName,
      assignedByRole: 'admin', approved: true, createdAt: offsetDate(today, -5),
      lastActivityAt: offsetDate(today, -5),
      lastNoChangeAt: yesterday,
    });
    const noChangeDays2 = getRecentWorkdays(today, 3);
    noChangeDays2.forEach((day, i) => {
      audit.push({
        id: aid(`402_${i}`), taskId: tid('402'), role: 'Employee',
        message: `No change reported by ${e6.name}.`,
        createdAt: `${day}T09:30:00Z`, dateTag: day, updateType: 'No Change',
      });
    });
  }

  // ── Handoff records ────────────────────────────────────────────────
  const handoffs: HandoffRecord[] = [];
  const handoffEmployeeIds = [e4.id, e5.id, e7.id, e14.id];
  for (let dayOffset = -5; dayOffset <= -1; dayOffset++) {
    const date = offsetDate(today, dayOffset);
    const dow = new Date(`${date}T12:00:00`).getDay();
    if (dow === 0 || dow === 6) continue;
    for (const empId of handoffEmployeeIds) {
      const seed = simpleHash(empId + date + 'handoff');
      if (seed % 10 < 7) {
        handoffs.push({
          userId: empId,
          date,
          completedAt: `${8 + (seed % 2)}:${String((seed * 3) % 60).padStart(2, '0')}`,
          tasksSummary: [
            { taskId: tid('201'), action: seed % 3 === 0 ? 'noChange' : 'update' },
          ],
          type: 'tasks_reviewed',
        });
      }
    }
  }

  // Generate 30 days of check-in history
  const checkIns: CheckIn[] = [];
  const checkInEmployeeIds = [e4.id, e5.id, e6.id, e7.id, e8.id, e14.id, e15.id];
  for (let dayOffset = -30; dayOffset <= -1; dayOffset++) {
    const date = offsetDate(today, dayOffset);
    const dow = new Date(`${date}T12:00:00`).getDay();
    if (dow === 0 || dow === 6) continue;

    for (const empId of checkInEmployeeIds) {
      const seed = simpleHash(empId + date);
      const checksIn = seed % 10 < 8;
      if (checksIn) {
        const hour = 8 + (seed % 3);
        const min = (seed * 7) % 60;
        checkIns.push({
          userId: empId,
          date,
          status: 'Checked-In',
          type: seed % 3 === 0 ? 'No Tasks' : 'Tasks Logged',
          checkedInAt: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
          summary: seed % 3 === 0 ? 'No active tasks' : `${1 + (seed % 4)} tasks reviewed`,
        });
      } else {
        checkIns.push({
          userId: empId,
          date,
          status: 'Missed',
          type: null,
          checkedInAt: null,
          summary: null,
        });
      }
    }
  }

  return { tasks, audit, checkIns, handoffs };
}

// ── Availability seed data ─────────────────────────────────────────────

export function generateAvailabilityRecords(
  teams: Team[],
  wsId: string,
): AvailabilityRecord[] {
  const today = getToday();
  const yesterday = offsetDate(today, -1);
  const tomorrow = offsetDate(today, 1);
  const twoDaysOut = offsetDate(today, 2);
  const threeDaysAgo = offsetDate(today, -3);
  const fiveDaysAgo = offsetDate(today, -5);
  const fourDaysAgo = offsetDate(today, -4);
  const sevenDaysOut = offsetDate(today, 7);
  const eightDaysOut = offsetDate(today, 8);

  const records: AvailabilityRecord[] = [];

  const t1m = teams[0]?.members || [];
  const t2m = teams[1]?.members || [];

  // 1. Employee currently sick today (pending — gets immediate protection)
  if (t1m[1]) {
    records.push({
      id: `${wsId}-avail-1`,
      organizationId: wsId,
      memberId: t1m[1].id,
      type: 'sick',
      status: 'pending',
      startDate: today,
      endDate: today,
      notes: 'Feeling unwell, staying home',
      requestedById: t1m[1].id,
      approvedById: null,
      createdAt: `${today}T07:30:00Z`,
      approvedAt: null,
    });
  }

  // 2. Employee on approved leave (yesterday → tomorrow)
  if (t1m[3]) {
    records.push({
      id: `${wsId}-avail-2`,
      organizationId: wsId,
      memberId: t1m[3].id,
      type: 'leave',
      status: 'approved',
      startDate: yesterday,
      endDate: tomorrow,
      notes: 'Family event',
      requestedById: t1m[3].id,
      approvedById: teams[0]?.lead.id || 'admin',
      createdAt: `${fourDaysAgo}T10:00:00Z`,
      approvedAt: `${threeDaysAgo}T09:00:00Z`,
    });
  }

  // 3. Pending leave request (future dates)
  if (t2m[0]) {
    records.push({
      id: `${wsId}-avail-3`,
      organizationId: wsId,
      memberId: t2m[0].id,
      type: 'leave',
      status: 'pending',
      startDate: sevenDaysOut,
      endDate: eightDaysOut,
      notes: 'Personal travel',
      requestedById: t2m[0].id,
      approvedById: null,
      createdAt: `${yesterday}T14:00:00Z`,
      approvedAt: null,
    });
  }

  // 4. Off-duty record (today, approved — created by manager)
  if (t2m[2]) {
    records.push({
      id: `${wsId}-avail-4`,
      organizationId: wsId,
      memberId: t2m[2].id,
      type: 'off_duty',
      status: 'approved',
      startDate: today,
      endDate: today,
      notes: 'Scheduled day off',
      requestedById: teams[1]?.lead.id || 'admin',
      approvedById: teams[1]?.lead.id || 'admin',
      createdAt: `${twoDaysOut}T08:00:00Z`,
      approvedAt: `${twoDaysOut}T08:00:00Z`,
    });
  }

  // 5. Rejected leave from last week
  if (t1m[4]) {
    records.push({
      id: `${wsId}-avail-5`,
      organizationId: wsId,
      memberId: t1m[4].id,
      type: 'leave',
      status: 'rejected',
      startDate: threeDaysAgo,
      endDate: yesterday,
      notes: 'Vacation request',
      requestedById: t1m[4].id,
      approvedById: teams[0]?.lead.id || 'admin',
      createdAt: `${fiveDaysAgo}T11:00:00Z`,
      approvedAt: `${fourDaysAgo}T09:00:00Z`,
    });
  }

  return records;
}

function getRecentWorkdays(today: string, count: number): string[] {
  const days: string[] = [];
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - 1);
  while (days.length < count) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() - 1);
  }
  return days.reverse();
}

function offsetDate(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
