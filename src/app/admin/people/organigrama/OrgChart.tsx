'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  photo_url: string | null;
  manager_id: string | null;
  department: { id: string; name: string } | null;
  legal_entity: { id: string; name: string } | null;
}

interface OrgNode extends Employee {
  children: OrgNode[];
  level: number;
}

interface OrgChartProps {
  employees: Employee[];
}

function buildOrgTree(employees: Employee[]): OrgNode[] {
  const employeeMap = new Map<string, OrgNode>();
  
  // First pass: create nodes
  employees.forEach(emp => {
    employeeMap.set(emp.id, { ...emp, children: [], level: 0 });
  });
  
  const roots: OrgNode[] = [];
  
  // Second pass: build tree
  employees.forEach(emp => {
    const node = employeeMap.get(emp.id)!;
    if (emp.manager_id && employeeMap.has(emp.manager_id)) {
      const parent = employeeMap.get(emp.manager_id)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  
  // Calculate levels
  function setLevels(node: OrgNode, level: number) {
    node.level = level;
    node.children.forEach(child => setLevels(child, level + 1));
  }
  
  roots.forEach(root => setLevels(root, 0));
  
  // Sort children by last name
  function sortChildren(node: OrgNode) {
    node.children.sort((a, b) => a.last_name.localeCompare(b.last_name));
    node.children.forEach(sortChildren);
  }
  
  roots.sort((a, b) => a.last_name.localeCompare(b.last_name));
  roots.forEach(sortChildren);
  
  return roots;
}

function EmployeeCard({ employee, isRoot = false }: { employee: OrgNode; isRoot?: boolean }) {
  const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
  
  return (
    <div className={`
      flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md
      ${isRoot ? 'border-emerald-200 ring-2 ring-emerald-100' : 'border-zinc-200'}
    `}>
      <div className="relative h-12 w-12 flex-shrink-0">
        {employee.photo_url ? (
          <Image
            src={employee.photo_url}
            alt={`${employee.first_name} ${employee.last_name}`}
            fill
            className="rounded-full object-cover"
          />
        ) : (
          <div className={`
            flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold
            ${isRoot ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}
          `}>
            {initials}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900">
          {employee.first_name} {employee.last_name}
        </p>
        {employee.job_title && (
          <p className="truncate text-sm text-zinc-500">{employee.job_title}</p>
        )}
        {employee.department && (
          <p className="truncate text-xs text-zinc-400">{employee.department.name}</p>
        )}
      </div>
      {employee.children.length > 0 && (
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600">
          {employee.children.length}
        </div>
      )}
    </div>
  );
}

function OrgTreeNode({ node, isLast = false }: { node: OrgNode; isLast?: boolean }) {
  const [expanded, setExpanded] = useState(node.level < 2);
  const hasChildren = node.children.length > 0;
  
  return (
    <div className="relative">
      {/* Vertical line from parent */}
      {node.level > 0 && (
        <div className="absolute -top-4 left-6 h-4 w-px bg-zinc-300" />
      )}
      
      <div className="relative flex items-start gap-2">
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-4 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50"
          >
            <svg className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="mt-4 w-5 flex-shrink-0" />
        )}
        
        <div className="flex-1">
          <EmployeeCard employee={node} isRoot={node.level === 0 && !node.manager_id} />
        </div>
      </div>
      
      {/* Children */}
      {hasChildren && expanded && (
        <div className="relative ml-2.5 mt-4 space-y-4 border-l border-zinc-300 pl-8">
          {node.children.map((child, idx) => (
            <OrgTreeNode
              key={child.id}
              node={child}
              isLast={idx === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgChart({ employees }: OrgChartProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  
  const orgTree = useMemo(() => buildOrgTree(employees), [employees]);
  
  const departments = useMemo(() => {
    const depts = new Map<string, string>();
    employees.forEach(emp => {
      if (emp.department) {
        depts.set(emp.department.id, emp.department.name);
      }
    });
    return Array.from(depts.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [employees]);
  
  // Filter tree based on search and department
  const filteredTree = useMemo(() => {
    if (!searchQuery && !selectedDepartment) return orgTree;
    
    const matchesFilter = (node: OrgNode): boolean => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        `${node.first_name} ${node.last_name}`.toLowerCase().includes(searchLower) ||
        (node.job_title?.toLowerCase().includes(searchLower) ?? false);
      
      const matchesDept = !selectedDepartment || node.department?.id === selectedDepartment;
      
      return matchesSearch && matchesDept;
    };
    
    const filterTree = (nodes: OrgNode[]): OrgNode[] => {
      return nodes.map(node => {
        const filteredChildren = filterTree(node.children);
        const nodeMatches = matchesFilter(node);
        const hasMatchingChildren = filteredChildren.length > 0;
        
        if (nodeMatches || hasMatchingChildren) {
          return { ...node, children: filteredChildren };
        }
        return null;
      }).filter(Boolean) as OrgNode[];
    };
    
    return filterTree(orgTree);
  }, [orgTree, searchQuery, selectedDepartment]);
  
  // Stats
  const stats = useMemo(() => {
    const totalEmployees = employees.length;
    const withManagers = employees.filter(e => e.manager_id).length;
    const rootEmployees = employees.filter(e => !e.manager_id).length;
    const deptCount = departments.length;
    
    return { totalEmployees, withManagers, rootEmployees, deptCount };
  }, [employees, departments]);

  // List view - flat hierarchy visualization
  const flattenedList = useMemo(() => {
    const result: OrgNode[] = [];
    const flatten = (nodes: OrgNode[]) => {
      nodes.forEach(node => {
        result.push(node);
        flatten(node.children);
      });
    };
    flatten(filteredTree);
    return result;
  }, [filteredTree]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Organigrama</h2>
          <p className="text-sm text-zinc-500">Estructura organizacional de la empresa</p>
        </div>
        
        {/* View mode toggle */}
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-1">
          <button
            onClick={() => setViewMode('tree')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'tree' ? 'bg-emerald-100 text-emerald-700' : 'text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            Árbol
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'list' ? 'bg-emerald-100 text-emerald-700' : 'text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Lista
          </button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-2xl font-semibold text-zinc-900">{stats.totalEmployees}</p>
          <p className="text-sm text-zinc-500">Empleados activos</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-2xl font-semibold text-zinc-900">{stats.rootEmployees}</p>
          <p className="text-sm text-zinc-500">Sin supervisor</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-2xl font-semibold text-zinc-900">{stats.withManagers}</p>
          <p className="text-sm text-zinc-500">Con supervisor</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-2xl font-semibold text-zinc-900">{stats.deptCount}</p>
          <p className="text-sm text-zinc-500">Departamentos</p>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 py-2 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Todos los departamentos</option>
          {departments.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        {(searchQuery || selectedDepartment) && (
          <button
            onClick={() => { setSearchQuery(''); setSelectedDepartment(''); }}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      
      {/* Org chart */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        {filteredTree.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="mt-4 text-zinc-500">No se encontraron empleados</p>
            {(searchQuery || selectedDepartment) && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedDepartment(''); }}
                className="mt-2 text-sm text-emerald-600 hover:text-emerald-700"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : viewMode === 'tree' ? (
          <div className="space-y-6">
            {filteredTree.map(root => (
              <OrgTreeNode key={root.id} node={root} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {flattenedList.map(emp => (
              <div
                key={emp.id}
                className="flex items-center gap-4 rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50"
                style={{ marginLeft: `${emp.level * 24}px` }}
              >
                <div className="relative h-10 w-10 flex-shrink-0">
                  {emp.photo_url ? (
                    <Image
                      src={emp.photo_url}
                      alt={`${emp.first_name} ${emp.last_name}`}
                      fill
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium text-zinc-600">
                      {emp.first_name[0]}{emp.last_name[0]}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900">{emp.first_name} {emp.last_name}</p>
                  <p className="text-sm text-zinc-500">{emp.job_title || 'Sin cargo'}</p>
                </div>
                {emp.department && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                    {emp.department.name}
                  </span>
                )}
                {emp.children.length > 0 && (
                  <span className="text-xs text-zinc-400">
                    {emp.children.length} reportes directos
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
