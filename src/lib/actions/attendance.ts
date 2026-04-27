'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

export type ClockActionState = {
	success?: boolean
	error?: string
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getCurrentEmployeeId(supabase: SupabaseClient, userId: string): Promise<{ employeeId: string } | ClockActionState> {
	const { data: employee, error } = await supabase.from('employees').select('id').eq('user_id', userId).maybeSingle()

	if (error) {
		return { error: error.message }
	}

	if (!employee) {
		return { error: 'Employee record not found' }
	}

	return { employeeId: employee.id }
}

async function getAssignmentForEmployee(
	supabase: SupabaseClient,
	appointmentEmployeeId: string,
	employeeId: string
): Promise<{ assignment: { employee_id: string; clocked_in_at: string | null; clocked_out_at: string | null } } | ClockActionState> {
	const { data: assignment, error } = await supabase
		.from('appointment_employees')
		.select('employee_id, clocked_in_at, clocked_out_at')
		.eq('id', appointmentEmployeeId)
		.maybeSingle()

	if (error) {
		return { error: error.message }
	}

	if (!assignment) {
		return { error: 'Assignment not found' }
	}

	if (assignment.employee_id !== employeeId) {
		return { error: 'Unauthorized: This assignment belongs to another employee' }
	}

	return { assignment }
}

async function updateClockTime(
	appointmentEmployeeId: string,
	column: 'clocked_in_at' | 'clocked_out_at'
): Promise<ClockActionState> {
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (!user) {
		return { error: 'Not authenticated' }
	}

	const employeeResult = await getCurrentEmployeeId(supabase, user.id)
	if ('error' in employeeResult) {
		return employeeResult
	}

	const assignmentResult = await getAssignmentForEmployee(supabase, appointmentEmployeeId, employeeResult.employeeId)
	if ('error' in assignmentResult) {
		return assignmentResult
	}

	if (column === 'clocked_in_at') {
		if (assignmentResult.assignment.clocked_in_at) {
			return { error: 'Already clocked in' }
		}

		if (assignmentResult.assignment.clocked_out_at) {
			return { error: 'Already clocked out - cannot clock in again' }
		}
	} else {
		if (!assignmentResult.assignment.clocked_in_at) {
			return { error: 'Must clock in before clocking out' }
		}

		if (assignmentResult.assignment.clocked_out_at) {
			return { error: 'Already clocked out' }
		}
	}

	const { error } = await supabase.from('appointment_employees').update({ [column]: new Date().toISOString() }).eq('id', appointmentEmployeeId)

	if (error) {
		return { error: error.message }
	}

	revalidatePath('/solutions/schedule')
	revalidatePath('/solutions/schedule/[id]', 'page')

	return { success: true }
}

export async function clockIn(appointmentEmployeeId: string): Promise<ClockActionState> {
	return updateClockTime(appointmentEmployeeId, 'clocked_in_at')
}

export async function clockOut(appointmentEmployeeId: string): Promise<ClockActionState> {
	return updateClockTime(appointmentEmployeeId, 'clocked_out_at')
}