# Institution data

`institutions.csv` holds 103 real Telangana institutions taken from AICTE's public approved-institutions list
(Permanent ID, name, district, address). Names and addresses were tidied (capitalisation, outdated
"Andhra Pradesh" text removed from addresses). One duplicate name was disambiguated as
"Vardhaman College of Engineering (Kokapet campus)". The complaints created by `npm run seed` are synthetic sample data.

## Using a different list

Replace the file (or delete it to use 26 built-in fictional institutions). Format:

    permanent_id,name,state,city,address        (type and year columns are optional)

Required: `permanent_id`, `name`, `state`. Bad rows are listed by line number when you run `npm run seed`, and skipped.
The first 8 rows get the most sample complaints, so overlaps show up clearly on them.
