const { BloodBank, Donor, User } = require("../config/db");

exports.getBloodInventory = async () => {
  const rows = await BloodBank.find().sort({ blood_group: 1 }).lean();
  return rows.map(r => ({ ...r, id: r._id }));
};

exports.updateBloodStock = async (bloodGroup, units) => {
  let status = "optimal";
  if (units <= 5) status = "critical";
  else if (units <= 15) status = "low";

  const updated = await BloodBank.findOneAndUpdate(
    { blood_group: bloodGroup },
    { units, status, last_updated: new Date() },
    { new: true }
  ).lean();

  if (updated) updated.id = updated._id;
  return updated;
};

exports.registerDonor = async (donorData) => {
  const { patient_id, blood_group, organ_to_donate } = donorData;
  const donor = await Donor.create({ patient_id, blood_group, organ_to_donate });
  return donor._id;
};

exports.getDonors = async () => {
  const rows = await Donor.find()
    .populate({ path: "patient_id", select: "name email" })
    .sort({ created_at: -1 })
    .lean();

  return rows.map(d => ({
    ...d,
    id: d._id,
    patient_name: d.patient_id ? d.patient_id.name : "",
    patient_email: d.patient_id ? d.patient_id.email : "",
    patient_id: d.patient_id ? d.patient_id._id : null
  }));
};

exports.getDonorByPatientId = async (patientId) => {
  const donor = await Donor.findOne({ patient_id: patientId }).lean();
  if (donor) donor.id = donor._id;
  return donor;
};
