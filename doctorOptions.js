export function normalizeDoctorSelection(doctors, selectedId) {
  if (!selectedId) return "";

  const normalizedId = String(selectedId).trim();

  if (!normalizedId) return "";

  const validDoctorIds = new Set(
    (Array.isArray(doctors) ? doctors : [])
      .filter(
        (doctor) =>
          doctor &&
          doctor.role === "doctor" &&
          doctor.isActive !== false &&
          doctor._id
      )
      .map((doctor) => String(doctor._id))
  );

  return validDoctorIds.has(normalizedId) ? normalizedId : "";
}

export function getDoctorOptions(doctors) {
  return (Array.isArray(doctors) ? doctors : [])
    .filter(
      (doctor) =>
        doctor &&
        doctor.role === "doctor" &&
        doctor.isActive !== false
    )
    .map((doctor) => ({
      value: String(doctor._id),
      label: doctor.name || doctor.username || "Doctor",
    }));
}
