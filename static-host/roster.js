/**
 * Simplified in-app deriveRoster for the static host.
 * Mirrors the demo-mode shape of GET /api/roster well enough for Team Tracker views.
 */

import { readFromStorage } from './fixtures.js'

function toMember(person, personFieldDefs) {
  const member = {
    name: person.name,
    jiraDisplayName: person.name,
    uid: person.uid,
    email: person.email,
    title: person.title,
    manager: person.managerUid || null,
    githubUsername: person.github?.username || person.githubUsername || null,
    gitlabUsername: person.gitlab?.username || person.gitlabUsername || null,
    geo: person.geo || null,
    location: person.location || null,
    country: person.country || null,
    city: person.city || null,
    engineeringSpeciality: person.engineeringSpeciality || null,
    customFields: {}
  }
  for (const fieldDef of personFieldDefs) {
    member.customFields[fieldDef.id] = person._appFields?.[fieldDef.id] ?? null
  }
  return member
}

export function deriveRoster() {
  const registry = readFromStorage('team-data/registry.json')
  if (!registry || !registry.people) {
    return { orgs: [], teamDataSource: 'in-app', visibleFields: [], primaryDisplayField: null }
  }

  const config = readFromStorage('team-data/config.json') || {}
  const teamsData = readFromStorage('team-data/teams.json') || { teams: {} }
  const fieldDefs = readFromStorage('team-data/field-definitions.json') || { personFields: [] }
  const personFieldDefs = (fieldDefs.personFields || []).filter(f => !f.deleted)
  const orgRoots = (config.orgRoots || []).map(r => r.uid)
  const orgRootSet = new Set(orgRoots)
  const displayNames = {}
  for (const root of config.orgRoots || []) {
    displayNames[root.uid] = root.displayName || root.name || root.uid
  }

  const teamIdToName = {}
  for (const team of Object.values(teamsData.teams || {})) {
    teamIdToName[team.id] = team.name
  }

  const orgMap = {}
  for (const [uid, person] of Object.entries(registry.people)) {
    if (person.status !== 'active') continue
    const orgKey = person.orgRoot || 'unknown'
    if (orgKey === '_auxiliary') continue
    if (!orgMap[orgKey]) orgMap[orgKey] = { leader: null, members: [] }
    if (orgRootSet.has(uid)) orgMap[orgKey].leader = person
    else orgMap[orgKey].members.push(person)
  }

  const visibleFields = personFieldDefs
    .filter(f => f.visible)
    .map(f => ({ key: f.id, label: f.label }))
  const primary = personFieldDefs.find(f => f.primaryDisplay)

  const orgs = []
  for (const [orgKey, orgData] of Object.entries(orgMap)) {
    const teamMap = {}
    const allMembers = [orgData.leader, ...orgData.members].filter(Boolean)

    for (const person of allMembers) {
      const memberEntry = toMember(person, personFieldDefs)
      let teamNames
      if (Array.isArray(person.teamIds) && person.teamIds.length > 0) {
        teamNames = person.teamIds.map(id => teamIdToName[id]).filter(Boolean)
        if (teamNames.length === 0) teamNames = ['_unassigned']
      } else {
        teamNames = ['_unassigned']
      }
      for (const teamName of teamNames) {
        if (!teamMap[teamName]) {
          teamMap[teamName] = {
            displayName: teamName === '_unassigned' ? 'Unassigned' : teamName,
            members: [],
            metadata: {}
          }
          const teamObj = Object.values(teamsData.teams || {}).find(
            t => t.name === teamName && t.orgKey === orgKey
          )
          if (teamObj) {
            teamMap[teamName].metadata = teamObj.metadata || {}
            teamMap[teamName].teamId = teamObj.id
            teamMap[teamName].description = teamObj.description || null
          }
        }
        teamMap[teamName].members.push(memberEntry)
      }
    }

    for (const team of Object.values(teamsData.teams || {})) {
      if (team.orgKey === orgKey && !teamMap[team.name]) {
        teamMap[team.name] = {
          displayName: team.name,
          members: [],
          metadata: team.metadata || {},
          teamId: team.id,
          description: team.description || null
        }
      }
    }

    orgs.push({
      key: orgKey,
      displayName: displayNames[orgKey] || orgData.leader?.name || orgKey,
      leader: orgData.leader
        ? { name: orgData.leader.name, uid: orgData.leader.uid, title: orgData.leader.title }
        : null,
      teams: teamMap
    })
  }

  return {
    orgs,
    teamDataSource: config.teamDataSource || 'in-app',
    visibleFields,
    primaryDisplayField: primary ? primary.id : null,
    generatedAt: registry.meta?.generatedAt || null
  }
}
