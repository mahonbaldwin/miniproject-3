//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

//create a fhir client based on the sandbox enviroment and test paitnet.
const client = new FHIR.client({
    serverUrl: "https://r4.smarthealthit.org",
    tokenResponse: {
        patient: "a6889c6d-6915-4fac-9d2f-fc6c42b3a82e"
    }
});

// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
    if (pt.name) {
        var names = pt.name.map(function (name) {
            return name.given.join(" ") + " " + name.family;
        });
        return names.join(" / ")
    } else {
        return "anonymous";
    }
}

// display the patient name gender and dob in the index page
function displayPatient(pt) {
    document.getElementById('patient_name').innerHTML = getPatientName(pt);
    document.getElementById('gender').innerHTML = pt.gender;
    document.getElementById('dob').innerHTML = pt.birthDate;
}

//function to display list of medications
function displayMedication(meds) {
    med_list.innerHTML += "<li> " + meds + "</li>";
}

//helper function to get quanity and unit from an observation resoruce.
function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
        return Number(parseFloat((ob.valueQuantity.value)).toFixed(2)) + ' ' + ob.valueQuantity.unit;
    } else {
        return undefined;
    }
}

// helper function to get both systolic and diastolic bp
function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function (observation) {
        var BP = observation.component.find(function (component) {
            return component.code.coding.find(function (coding) {
                return coding.code == typeOfPressure;
            });
        });
        if (BP) {
            observation.valueQuantity = BP.valueQuantity;
            formattedBPObservations.push(observation);
        }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
}

// create a patient object to initalize the patient
function defaultPatient() {
    return {
        height: {
            value: ''
        },
        weight: {
            value: ''
        },
        sys: {
            value: ''
        },
        dia: {
            value: ''
        },
        ldl: {
            value: ''
        },
        hdl: {
            value: ''
        },
        note: 'No Annotation',
    };
}

//helper function to display the annotation on the index page
function displayAnnotation(annotation) {
    note.innerHTML = annotation;
}

//function to display the observation values you will need to update this
function displayObservation(obs) {
    hdl.innerHTML = obs.hdl;
    ldl.innerHTML = obs.ldl;
    sys.innerHTML = obs.sys;
    dia.innerHTML = obs.dia;
    console.log('setting height', obs.height);
    height.innerHTML = obs.height;
    // document.getElementById('height').innerHTML = obs.height;
    document.getElementById('weight').innerHTML = obs.weight;
}

// get patient object and then display its demographics info in the banner
client.request(`Patient/${client.patient.id}`).then(
    function (patient) {
        displayPatient(patient);
        console.log(patient);
    }
);

const codes = {
    'height-standing': '8308-9',//Body height --standing
    'height': '8302-2',//Body height
    'weight-body': '3141-9',//Body weight Measured
    'weight-clothes': '8352-7', //Clothing worn during measure
    'weight-bwc': '8350-1', //Body weight Measured --with clothes
    'weight-stated': '3142-7',//Body weight stated
    'weight': '29463-7',//Body weight stated
    'meds-section': '46057-6',//medications section
    'meds-plain': '52471-0',//medications
    'meds-sum-doc': '56445-0',//Medcication summary docuemnt
    'meds-curr-set': '18160-0',//medicaation current set
    'meds-curr-dose': '52809-1'//dose of current medication
};

// get observation resource values
// you will need to update the below to retrive the weight and height values
var query = new URLSearchParams();

query.set("patient", client.patient.id);
query.set("_count", 100);
query.set("_sort", "-date");
query.set("code", [
    'http://loinc.org|8462-4',//Diastolic blood pressure
    'http://loinc.org|8480-6',//Systolic blood pressure
    'http://loinc.org|2085-9',//Cholesterol in HDL [Mass/volume] in Serum or Plasma
    'http://loinc.org|2089-1',//Cholesterol in LDL [Mass/volume] in Serum or Plasma
    'http://loinc.org|55284-4',//Blood pressure systolic and diastolic
    'http://loinc.org|3141-9',//Body weight Measured

    'http://loinc.org|' + codes['height'],
    'http://loinc.org|' + codes['weight']

].join(","));

let weightObservation = null;

client.request("Observation?" + query, {
    pageLimit: 0,
    flat: true
}).then(
    function (ob) {
        // group all of the observation resoruces by type into their own
        console.log('ob', ob);
        const byCodes = client.byCodes(ob, 'code');
        const systolicbp = getBloodPressureValue(byCodes('55284-4'), '8480-6');
        const diastolicbp = getBloodPressureValue(byCodes('55284-4'), '8462-4');
        const hdl = byCodes('2085-9');
        const ldl = byCodes('2089-1');
        const height = byCodes(codes['height']);
        const weight = byCodes(codes['weight']);

        weightObservation = weight[weight.length-1]

        console.log('weight*****', weight);
        // create patient object
        let p = defaultPatient();

        // set patient value parameters to the data pulled from the observation resoruce
        if (typeof systolicbp != 'undefined') {
            p.sys = systolicbp;
        } else {
            p.sys = 'undefined'
        }

        if (typeof diastolicbp != 'undefined') {
            p.dia = diastolicbp;
        } else {
            p.dia = 'undefined'
        }

        p.hdl = getQuantityValueAndUnit(hdl[0]);
        p.ldl = getQuantityValueAndUnit(ldl[0]);
        p.height = getQuantityValueAndUnit(height[0]);
        p.weight = getQuantityValueAndUnit(weight[0]);

        displayObservation(p)

    });

client.request(`/MedicationRequest?patient=` + client.patient.id, {
    resolveReferences: "medicationReference"
}).then(function (meds) {
        console.log('meds', meds);
        meds.entry.forEach(function (med) {
            displayMedication(med.resource.medicationCodeableConcept.text);
        })
    },
    function (error) {
        document.getElementById("meds").innerText = error.stack;
    }
);

// source https://stackoverflow.com/questions/17415579/how-to-iso-8601-format-a-date-with-timezone-offset-in-javascript
Date.prototype.toFullIsoString = function () {
    var tzo = -this.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function (num) {
            var norm = Math.floor(Math.abs(num));
            return (norm < 10 ? '0' : '') + norm;
        };
    return this.getFullYear() +
        '-' + pad(this.getMonth() + 1) +
        '-' + pad(this.getDate()) +
        'T' + pad(this.getHours()) +
        ':' + pad(this.getMinutes()) +
        ':' + pad(this.getSeconds()) +
        dif + pad(tzo / 60) +
        ':' + pad(tzo % 60);
}

//update function to take in text input from the app and add the note for the latest weight observation annotation
//you should include text and the author can be set to anything of your choice. keep in mind that this data will
// be posted to a public sandbox
function addWeightAnnotation() {
    let annotation = document.getElementById("annotation").value;
    displayAnnotation(annotation);
    weightObservation.annotation = {
        'authorString': 'testUser',
        'text': annotation,
        'time': new Date().toFullIsoString()
    };
    client.update(weightObservation);
}

//event listner when the add button is clicked to call the function that will add the note to the weight observation
document.getElementById('add').addEventListener('click', addWeightAnnotation);
