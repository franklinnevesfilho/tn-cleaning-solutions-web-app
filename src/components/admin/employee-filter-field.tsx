'use client'

import { useState } from 'react'

import { SearchableSelect } from '@/components/ui/searchable-select'

type EmployeeOption = {
	id: string
	full_name: string
}

export function EmployeeFilterField({
	employees,
	defaultValue,
}: {
	employees: EmployeeOption[]
	defaultValue: string
}) {
	const [value, setValue] = useState(defaultValue)

	const options = [
		{ value: '', label: 'All employees' },
		...employees.map((e) => ({ value: e.id, label: e.full_name })),
	]

	return (
		<>
			<input type="hidden" name="employee" value={value} />
			<SearchableSelect
				options={options}
				value={value}
				onValueChange={setValue}
				placeholder="All employees"
				searchPlaceholder="Search employees…"
				emptyMessage="No employees found."
			/>
		</>
	)
}