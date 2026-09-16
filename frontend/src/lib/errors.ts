import axios from "axios";

type Translate = (key: string) => string;

// The backend's HTTPException detail strings are plain English (see app/api/v1/*.py and
// app/core/deps.py) — this maps each known one to an i18n key so error snackbars/alerts
// respect the active locale instead of always showing English.
const EXACT_MESSAGE_KEYS: Record<string, string> = {
  "Incorrect username or password": "errors.incorrect_credentials",
  "Could not validate credentials": "errors.could_not_validate_credentials",
  "You do not have access to this department": "errors.no_department_access",
  "head_user_id must belong to an existing Dean account": "errors.head_must_be_dean",
  "Department not found": "errors.department_not_found",
  "Cannot delete a department that still has teachers, subjects, or groups": "errors.department_has_dependents",
  "This account has no teacher profile": "errors.no_teacher_profile",
  "You do not teach this class": "errors.not_your_class",
  "Schedule entry not found": "errors.schedule_entry_not_found",
  "Session not found": "errors.session_not_found",
  "Grades can only be entered for a lesson marked as an exam": "errors.grades_exam_only",
  "Assignment not found": "errors.assignment_not_found",
  "Teacher not found": "errors.teacher_not_found",
  "Group name already exists": "errors.group_name_exists",
  "Group not found": "errors.group_not_found",
  "You do not teach this hafiz group": "errors.not_your_hafiz_group",
  "This student is not in a hafiz group": "errors.student_not_hafiz_group",
  "You do not teach this student's hafiz group": "errors.not_your_students_hafiz_group",
  "This group is not a hafiz group": "errors.group_not_hafiz",
  "This roster was just updated elsewhere — reload and retry": "errors.roster_conflict",
  "Student not found": "errors.student_not_found",
  "Target not found": "errors.target_not_found",
  "Exam not found": "errors.exam_not_found",
  "You may only delete your own notes": "errors.only_delete_own_notes",
  "Note not found": "errors.note_not_found",
  "You do not teach this student's group": "errors.not_your_students_group",
  "Room not found": "errors.room_not_found",
  "Cannot delete a room that still has schedule entries": "errors.room_has_dependents",
  "Teaching assignment not found": "errors.teaching_assignment_not_found",
  "Cannot delete an assignment that still has schedule entries": "errors.assignment_has_dependents",
  "Cannot remove a schedule entry that already has lessons recorded against it": "errors.schedule_entry_has_dependents",
  "This slot is already booked": "errors.slot_already_booked",
  "Semester not found": "errors.semester_not_found",
  "Cannot delete a semester that still has assignments or schedule entries": "errors.semester_has_dependents",
  "Student number already exists": "errors.student_number_exists",
  "Subject code already exists": "errors.subject_code_exists",
  "Subject not found": "errors.subject_not_found",
  "No teacher profile for this account": "errors.no_teacher_profile_for_account",
  "You may only view your own profile": "errors.only_view_own_profile",
  "Username already taken": "errors.username_taken",
  "Time slot not found": "errors.time_slot_not_found",
  "Cannot delete a time slot that still has schedule entries": "errors.time_slot_has_dependents",
  "This teacher is already assigned to this subject/group/semester/hour type": "errors.teacher_already_assigned",
  "This teacher already has a class at that day and time slot": "errors.conflict_teacher",
  "This room is already booked at that day and time slot": "errors.conflict_room",
  "This group already has a class at that day and time slot": "errors.conflict_group",
  "end_date must be on or after start_date": "errors.hifz_end_before_start",
  "Target period cannot exceed 400 days": "errors.hifz_target_too_long",
  "juz_to must be >= juz_from": "errors.hifz_juz_order",
  "page_to must be >= page_from": "errors.hifz_page_order",
};

const PATTERN_MESSAGE_KEYS: { pattern: RegExp; key: string }[] = [
  { pattern: /^Role \S+ is not permitted to perform this action$/, key: "errors.role_not_permitted" },
  { pattern: /^Student\(s\) .+ are not in group .+$/, key: "errors.hifz_student_not_in_group" },
];

function translateDetail(detail: string, t: Translate): string | null {
  const stripped = detail.replace(/^Value error,\s*/, "");
  const exactKey = EXACT_MESSAGE_KEYS[stripped];
  if (exactKey) return t(exactKey);
  const patternMatch = PATTERN_MESSAGE_KEYS.find((p) => p.pattern.test(stripped));
  if (patternMatch) return t(patternMatch.key);
  return null;
}

export function apiErrorMessage(error: unknown, fallback: string, t: Translate): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return translateDetail(detail, t) ?? detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d) => {
          const msg = d.msg ?? JSON.stringify(d);
          return translateDetail(msg, t) ?? msg;
        })
        .join("; ");
    }
  }
  return fallback;
}
