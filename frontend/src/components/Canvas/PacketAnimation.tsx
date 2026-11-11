/**
 * Packet Animation Logic Component
 * Manages hop-by-hop simulation timing and state updates
 * Visual animation is handled by CustomEdge using SVG animateMotion (React Flow official approach)
 */

import { useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { useSimulationStore } from '@/store/simulationStore';
import { useNetworkStore } from '@/store/networkStore';

const PacketAnimation = () => {
  const reactFlowInstance = useReactFlow();

  const isRunning = useSimulationStore((state) => state.isRunning);
  const path = useSimulationStore((state) => state.path);
  const hopDelay = useSimulationStore((state) => state.hopDelay);
  const setCurrentHop = useSimulationStore((state) => state.setCurrentHop);
  const setCurrentConnection = useSimulationStore((state) => state.setCurrentConnection);
  const stopSimulation = useSimulationStore((state) => state.stopSimulation);

  const setSelectedDevice = useNetworkStore((state) => state.setSelectedDevice);
  const connections = useNetworkStore((state) => state.connections);

  useEffect(() => {
    if (!isRunning || !path || path.length < 2) {
      return;
    }

    const animatePacketHopByHop = async () => {
      try {
        // Animate through the path hop-by-hop
        for (let i = 0; i < path.length - 1; i++) {
          const sourceId = path[i];
          const targetId = path[i + 1];

          // Update current hop in store
          setCurrentHop(i);

          // Highlight current source device
          setSelectedDevice(sourceId);

          // Get nodes from React Flow
          const sourceNode = reactFlowInstance.getNode(sourceId);
          const targetNode = reactFlowInstance.getNode(targetId);

          if (!sourceNode || !targetNode) {
            console.warn(`Missing node: ${sourceId} or ${targetId}`);
            continue;
          }

          // Find the connection between these two nodes
          // Try both directions (connection could be stored either way)
          const connection = connections.find(
            (conn) =>
              (conn.source === sourceId && conn.target === targetId) ||
              (conn.source === targetId && conn.target === sourceId)
          );

          if (!connection) {
            console.warn(`No connection found between ${sourceId} and ${targetId}`);
            continue;
          }

          // Determine if packet is traveling in reverse direction of connection
          // Connection is stored as source→target, but packet might travel target→source
          const isCorrectDirection = connection.source === sourceId && connection.target === targetId;
          const isReversed = !isCorrectDirection;

          // Set current connection with direction info - This triggers the animation in CustomEdge
          setCurrentConnection(connection.id, isReversed);

          // Calculate approximate duration based on node positions
          // (CustomEdge calculates exact duration using handle positions)
          const sourcePos = sourceNode.position;
          const targetPos = targetNode.position;

          const sourceWidth = sourceNode.width || 120;
          const sourceHeight = sourceNode.height || 100;
          const targetWidth = targetNode.width || 120;
          const targetHeight = targetNode.height || 100;

          // Calculate center positions for approximate distance
          const sourceCenterX = sourcePos.x + sourceWidth / 2;
          const sourceCenterY = sourcePos.y + sourceHeight / 2;
          const targetCenterX = targetPos.x + targetWidth / 2;
          const targetCenterY = targetPos.y + targetHeight / 2;

          // Approximate animation duration (same formula as CustomEdge)
          const edgeLength = Math.sqrt(
            Math.pow(targetCenterX - sourceCenterX, 2) + Math.pow(targetCenterY - sourceCenterY, 2)
          );
          const duration = Math.max(edgeLength * 3, 400); // 3ms per unit, minimum 400ms

          // Wait for animation to complete
          await new Promise((resolve) => setTimeout(resolve, duration));

          // Pause at intermediate hops (not at start or end)
          if (i > 0 && i < path.length - 2) {
            // Highlight the intermediate device we just reached
            setSelectedDevice(targetId);

            // Pause for hop delay (didactic pause)
            await new Promise((resolve) => setTimeout(resolve, hopDelay));
          }
        }

        // Highlight final destination device
        setSelectedDevice(path[path.length - 1]);

        // Brief pause at destination
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error('Animation error:', error);
      } finally {
        // Clear selection and stop simulation when done
        setSelectedDevice(null);
        setCurrentConnection(null);
        stopSimulation();
      }
    };

    animatePacketHopByHop();
  }, [isRunning, path, hopDelay, reactFlowInstance, setCurrentHop, setSelectedDevice, setCurrentConnection, stopSimulation, connections]);

  // This component only manages logic, no visual rendering
  return null;
};

export default PacketAnimation;
