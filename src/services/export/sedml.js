export function generateSedmlData(simData) {
  const numberOfSteps = Math.floor((simData.endingPoint - simData.startingPoint) / simData.pointInterval) + 1
  return `<?xml version="1.0" encoding="UTF-8"?>
<sedML xmlns="http://sed-ml.org/sed-ml/level1/version4" level="1" version="4">
  <listOfModels>
    <model id="model1" language="urn:sedml:language:cellml" source="model.cellml">
    </model>
  </listOfModels>
  <listOfSimulations>
    <uniformTimeCourse id="simulation1" initialTime="${simData.initialPoint}" outputStartTime="${simData.startingPoint}" outputEndTime="${simData.endingPoint}" numberOfSteps="${numberOfSteps}">
      <algorithm kisaoID="KISAO:0000019">
        <listOfAlgorithmParameters>
          <algorithmParameter kisaoID="KISAO:0000209" value="1e-07"/>
          <algorithmParameter kisaoID="KISAO:0000211" value="1e-07"/>
          <algorithmParameter kisaoID="KISAO:0000415" value="500"/>
          <algorithmParameter kisaoID="KISAO:0000467" value="0"/>
          <algorithmParameter kisaoID="KISAO:0000475" value="BDF"/>
          <algorithmParameter kisaoID="KISAO:0000476" value="Newton"/>
          <algorithmParameter kisaoID="KISAO:0000477" value="Dense"/>
          <algorithmParameter kisaoID="KISAO:0000478" value="Banded"/>
          <algorithmParameter kisaoID="KISAO:0000479" value="0"/>
          <algorithmParameter kisaoID="KISAO:0000480" value="0"/>
          <algorithmParameter kisaoID="KISAO:0000481" value="true"/>
        </listOfAlgorithmParameters>
      </algorithm>
    </uniformTimeCourse>
  </listOfSimulations>
  <listOfTasks>
    <task id="task1" modelReference="model1" simulationReference="simulation1"/>
  </listOfTasks>
</sedML>`
}

// return

// const mathML = `<math xmlns="http://www.w3.org/1998/Math/MathML" xmlns:cellml="http://www.cellml.org/cellml/2.0#">
//       <apply>
//         <eq/>
//         <ci>${outNewName}</ci>
//         <apply>
//           <plus/>
//           <apply>
//             <times/>
//             <cn cellml:units="dimensionless">${scale}</cn>
//             <ci>${inNewName}</ci>
//           </apply>
//           <cn cellml:units="${outUnitName}">${offset}</cn>
//         </apply>
//       </apply>
//     </math>`
