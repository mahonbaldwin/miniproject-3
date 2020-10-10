//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

let medCount = 0;
let finishedMedCount = 0;

function fe(url, cb) {
    console.log('calling ' + url);
    const proxy_url = 'https://cors-anywhere.herokuapp.com/';
    var myHeaders = new Headers();
    myHeaders.append("Access-Control-Allow-Origin", "*");
    myHeaders.append("Accept", "application/json");
    fetch(proxy_url + url, {
        headers: myHeaders
    }).then(function (response) {
        return response.json();
    }).then(cb);
}

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

// get patient object and then display its demographics info in the banner
client.request(`Patient/${client.patient.id}`).then(
    function (patient) {
        displayPatient(patient);
        console.log(patient);
    }
);

function uniqueMedName(medName){
    return medName.replace(/[^a-zA-Z\s]/g, ' ');
}

function uniqueHTMLMedName(medName){
    return "med_" + medName.replace(/[^a-zA-Z\s]/g, '').replace(/\s/g, "-");
}


function compareLinks(a, b){
    if(a.matchStrength > b.matchStrength) return -1;
    if(a.matchStrength < b.matchStrength) return 1;
    return 0;
}

function addLinkDivs(medName){
    let html = "<div id='div_"+uniqueHTMLMedName(medName)+"' class=\"big-card med-link-container\"><div class=\"card\">" +
        "<div class=\"title\">\n" +
        "Links for " + medName + "<span id='count_"+uniqueHTMLMedName(medName)+"'> (none found)</span>" +//" (" + links.length + " total)" +
        "</div>" +
        "<div id='"+uniqueHTMLMedName(medName)+"' >" +
        "</div>" +
        "</div></div>";

    document.getElementById("link-container").innerHTML = document.getElementById("link-container").innerHTML + html;
}

function addLinksToDiv(medName, drugInfo){
    let links = '';
    drugInfo[medName].links.sort(compareLinks).forEach(function(med){
        links += "<li><a href='"+med.link+"'>"+med.name+"</a></li>"
    });
    document.getElementById(uniqueHTMLMedName(medName)).innerHTML = "<ul>" +
        links +
        "</ul>"
    document.getElementById("count_"+uniqueHTMLMedName(medName)).innerText = " (" + links.length + " total)";
}

function clickInsert(drugName){
    console.log(drugName);

}

//function to display list of medications
function displayMedication(med) {
    drugId = 'insert_drug_id_' + med.id;

    med_list.innerHTML += "<tr><td>" + med.name + "</td><td>" + med.status + "</td><td>" + med.dose + "</td>" +
        "<td class='insert-click' id='" + drugId + "' data-drugname='"+ med.name +"'><a>inserts</a></td>";
}

function dosagePeriods(dose) {
    let p = null;
    switch (dose) {
        case "d":
            p = "day(s)"
            break;
    }
    return p;
}

function dosageInfo(di) {
    let dosage = "";
    if (di.doseAndRate[0].doseQuantity.value) {
        dosage += di.doseAndRate[0].doseQuantity.value + " dose ";
    }
    dosage += di.timing.repeat.frequency + " time(s) every " + di.timing.repeat.period + " " + dosagePeriods(di.timing.repeat.periodUnit)
    if (di.asNeededBoolean) {
        dosage += "As needed";
    }
    return dosage;
}

function matches(regex, s) {
    return s.match(regex).length;
}

function addResponse(di, drugName, response, regEx) {
    const baseUrl = 'https://dailymed.nlm.nih.gov/dailymed/downloadpdffile.cfm?setId='
    di[drugName] = di[drugName] || {};
    di[drugName]['responses'] = di[drugName]['responses'] || [];
    di[drugName]['responses'].push(response);
    di[drugName]['links'] = di[drugName]['links'] || [];
    response['DATA'].forEach(function ([setId, title, splVersion, pubdate]) {
        di[drugName]['links'].push(
            {
                'link': baseUrl + setId,
                'name': title,
                'splVersion': splVersion,
                'pubdate': pubdate,
                'matchStrength': matches(regEx, title)
            })
    });
    return di;
}

let drugInfo = {};

function getInsertLinks(drugName) {
    const drugNameComponents = uniqueMedName(drugName).split(" ").filter(w => w !== '');
    const regExString = '(' +
        drugNameComponents.reduce(function (pv, cv) {
            if (pv !== '') {
                pv = pv + '|'
            }
            return pv + cv;
        }, '') +
        ')';
    const regEx = new RegExp(regExString, 'gi');

    //regord the responses to the
    drugNameComponents.map(n => fe('https://dailymed.nlm.nih.gov/dailymed/services/v1/drugname/' + n + '/spls.json',
        function (js) {
            drugInfo = addResponse(drugInfo, drugName, js, regEx);
            addLinksToDiv(drugName, drugInfo);
        }));
    finishedMedCount++;
}

client.request(`/MedicationRequest?patient=` + client.patient.id, {
    resolveReferences: "medicationReference"
}).then(
    function (meds) {
        medCount = meds.entry.length;
        console.log('medcount', medCount);
        let drugId = 0;
        meds.entry.forEach(function (med) {
            const drugName = med.resource.medicationCodeableConcept.text;
            addLinkDivs(drugName)
            getInsertLinks(drugName);
            let dosageText = "";
            let dosageInformation = med.resource.dosageInstruction || [];
            dosageInformation.forEach(function (di) {
                dosageText += dosageInfo(di) + "<br />";
            });
            displayMedication(
                {
                    "name": drugName,
                    "status": med.resource.status,
                    "dose": dosageText,
                    "id": drugId
                });
            // document.getElementById('insert_drug_id_'+drugId).addEventListener('click', clickInsert);

            drugId++;
            //document.getElementById('insert_drug_id_'+drugId).onclick = function(){alert('hello')}; //function(){clickInsert(drugName)};
        })
    },
    function (error) {
        //document.getElementById("meds").innerText = error.stack;
    }
).then(function(_){
    let els = document.getElementsByClassName("insert-click");
    els.forEach(function(el){
        console.log(el);
        console.log(el.dataset);
        el.onclick = function(){
            document.getElementsByClassName("med-link-container").forEach(function(e){
                e.style.display = "none";
            });
            document.getElementById("div_"+uniqueHTMLMedName(el.dataset.drugname)).style.display = "block";
        };
    });
});
