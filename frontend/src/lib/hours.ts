import type { HourType, Subject, TeachingAssignment } from "../api/types";

function subjectHoursFor(subject: Subject | undefined, hourType: HourType): number {
  if (!subject) return 0;
  if (hourType === "LECTURE") return subject.lecture_hours;
  if (hourType === "PRACTICE") return subject.practice_hours;
  return subject.lab_hours;
}

/** Sum of term hours across a teacher's assignments, using the subject's hour-type total
 * as the per-assignment hour count (TeachingAssignment itself doesn't store a number). */
export function termHoursForTeacher(
  assignments: TeachingAssignment[],
  subjects: Subject[],
  teacherId: number,
): number {
  return assignments
    .filter((a) => a.teacher_id === teacherId)
    .reduce((sum, a) => sum + subjectHoursFor(subjects.find((s) => s.id === a.subject_id), a.hour_type), 0);
}
