import React from 'react';
import { ArrowLeftRight } from 'lucide-react';

function DirectionChangeButton({ directionSwitched, setDirectionSwitched }) {
	const handleClick = () => {
		setDirectionSwitched(!directionSwitched);
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			style={{
				backgroundColor: directionSwitched ? '#fab164' : '#6eb9ff',
				color: 'black',
				border: directionSwitched ? '2px solid #ff8c00' : '2px solid #0088ff',
				borderRadius: 6,
				padding: '14px 16px',
				cursor: 'pointer',
				fontSize: 16,
				fontWeight: 600,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				width: '100%',
				gap: 8,
			}}
		>
			<ArrowLeftRight
				size={18}
				style={{
					transform: directionSwitched ? 'rotate(180deg)' : 'rotate(0deg)',
					transition: 'transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1)',
				}}
			/>
			Switch Direction
		</button>
	);
}

export default DirectionChangeButton;
