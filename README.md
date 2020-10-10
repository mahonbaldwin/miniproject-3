# Mini Project 3

## Purpose

This app will retrieve a list of medications for a patient and print out the instructions for use as well as provide links to the insert information


1. search for the each part of the medicine name at: `https://dailymed.nlm.nih.gov/dailymed/services/v1/drugname/[search term]/spls.json`
1. For each non-empty result take the first element (the id) and display a link on the page to `https://dailymed.nlm.nih.gov/dailymed/downloadzipfile.cfm?setId={setid}`