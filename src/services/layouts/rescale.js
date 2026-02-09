import { RESCALE_ASPECT_RATIO, RESCALE_TARGET_SPACING } from "../../utils/constants"


// Used to rescale prescribed positions optionally provided in the vessel array file
export async function runRescaleLayout(nodes, aspectRatio = RESCALE_ASPECT_RATIO, targetSpacing = RESCALE_TARGET_SPACING) {
    try {
        // Get range of x and y values
        let xMin = Infinity, xMax = -Infinity
        let yMin = Infinity, yMax = -Infinity

        nodes.forEach(node => {
            xMin = Math.min(xMin, node.position.x)
            xMax = Math.max(xMax, node.position.x)
            yMin = Math.min(yMin, node.position.y)
            yMax = Math.max(yMax, node.position.y)
        })

        // Scale x and y independently due to typical wide aspect ratio
        const xRange = xMax - xMin
        const yRange = yMax - yMin

        const xScale = (targetSpacing * aspectRatio) / xRange
        const yScale = targetSpacing / yRange

        nodes.forEach(node => {
            node.position = {
                x: (node.position.x - xRange / 2) * xScale,
                y: (node.position.y - yRange / 2) * yScale
            }
        })
        return true
    } catch (err) {
        console.error('Rescale Layout Failed:', err)
        return false
    }
}
}